import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoanApplication } from '../LoanApplicationContext';
import './Details.css';

export default function Details() {
  const navigate = useNavigate();
  
  // Get context data and functions
  const { personalDetailsData, updatePersonalDetailsData } = useLoanApplication();
  
  // Form state for Step 2 - initialize with context data
  const [formData, setFormData] = useState({
    firstName: personalDetailsData.firstName || '',
    lastName: personalDetailsData.lastName || '',
    email: personalDetailsData.email || '',
    phoneNumber: personalDetailsData.phoneNumber || ''
  });

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for phone number
    if (name === 'phoneNumber') {
      // Remove any non-digit characters
      const digitsOnly = value.replace(/\D/g, '');
      // Limit to 9 digits (Somalia standard)
      const limitedDigits = digitsOnly.slice(0, 9);
      setFormData(prev => ({
        ...prev,
        [name]: limitedDigits
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle form submission (Next)
  const handleNext = (e) => {
    e.preventDefault();
    
    // Save personal details to context
    updatePersonalDetailsData(formData);
    
    // Navigate to summary
    navigate('/summary');
  };

  // Handle previous button
  const handlePrevious = () => {
    // Save current data before going back
    updatePersonalDetailsData(formData);
    navigate(-1);
  };

  // Handle back button
  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="app-container">
      
      {/* ==================== HEADER ==================== */}
      <header className="header">
        <button className="back-btn" onClick={handleBack}>
          ← Dib u noqo
        </button>
        <div className="logo">
          <span className="logo-waafi">Waafi</span>
        </div>
        <button className="menu-btn" aria-label="Menu">
          <div className="menu-line"></div>
          <div className="menu-line"></div>
          <div className="menu-line"></div>
        </button>
      </header>

      {/* ==================== MAIN CONTENT ==================== */}
      <main className="main-content">
        <div className="container">
          
          {/* Title Section */}
          <h1 className="form-title">Codsiga Amaahda</h1>
          <p className="form-subtitle">Tallaabada 2 ee 3</p>

          {/* Progress Indicator */}
          <div className="progress-indicator">
            <div className="progress-dot active"></div>
            <div className="progress-dot active"></div>
            <div className="progress-dot"></div>
          </div>

          {/* Application Form */}
          <form onSubmit={handleNext}>
            
            {/* First Name and Last Name Row */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Magaca Hore</label>
                <input 
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Ahmed"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Magaca Dambe</label>
                <input 
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Hassan"
                  className="form-input"
                  required
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="form-group">
              <label className="form-label">Ciwaanka Emailka</label>
              <input 
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="ahmed.hassan@example.com"
                className="form-input"
                required
              />
            </div>

            {/* Phone Number */}
            <div className="form-group">
              <label className="form-label">Lambarka Taleefanka</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '12px 16px', 
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontWeight: '500'
                }}>
                  +252
                </div>
                <input 
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  placeholder="612345678"
                  className="form-input"
                  style={{ flex: 1 }}
                  pattern="[0-9]{9}"
                  minLength="9"
                  maxLength="9"
                  required
                />
              </div>
              <small style={{ display: 'block', marginTop: '4px', color: '#666', fontSize: '12px' }}>
                Geli 9 tiro (tusaale: 612345678 ama 907654321)
              </small>
            </div>

            {/* Button Container */}
            <div className="button-container">
              <button 
                type="button" 
                className="previous-btn"
                onClick={handlePrevious}
              >
                KA HORE
              </button>
              <button type="submit" className="next-btn">
                TALLAABADA XIGTA
              </button>
            </div>
          </form>

        </div>
      </main>

      {/* ==================== FOOTER ==================== */}
      <footer className="footer">
        © 2026 Waafi Soomaaliya
      </footer>
    </div>
  );
}
