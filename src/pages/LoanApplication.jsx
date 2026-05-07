import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoanApplication } from '../LoanApplicationContext';
import './LoanApplication.css';

export default function LoanApplication() {
  const navigate = useNavigate();
  
  // Get context data and functions
  const { loanApplicationData, updateLoanApplicationData } = useLoanApplication();
  
  // Form state - initialize with data from context
  const [formData, setFormData] = useState({
    loanType: loanApplicationData.loanType || 'Amaah Shakhsi ah',
    loanAmount: loanApplicationData.loanAmount || '',
    loanTerm: loanApplicationData.loanTerm || '12 Bilood',
    purpose: loanApplicationData.purpose || ''
  });

  // Update form if context data changes (e.g., from calculator)
  useEffect(() => {
    if (loanApplicationData.loanAmount) {
      setFormData(prev => ({
        ...prev,
        loanAmount: loanApplicationData.loanAmount,
        loanTerm: loanApplicationData.loanTerm
      }));
    }
  }, [loanApplicationData]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Save form data to context
    updateLoanApplicationData(formData);
    
    // Navigate to next step
    navigate('/details');
  };

  // Handle back button
  const handleBack = () => {
    navigate(-1);
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
          <p className="form-subtitle">Tallaabada 1 ee 3</p>

          {/* Progress Indicator */}
          <div className="progress-indicator">
            <div className="progress-dot active"></div>
            <div className="progress-dot"></div>
            <div className="progress-dot"></div>
          </div>

          {/* Application Form */}
          <form onSubmit={handleSubmit}>
            
            {/* Loan Type */}
            <div className="form-group">
              <label className="form-label">Nooca Amaahda</label>
              <select 
                name="loanType"
                value={formData.loanType}
                onChange={handleChange}
                className="form-select"
              >
                <option value="Amaah Shakhsi ah">Amaah Shakhsi ah</option>
                <option value="Amaah Ganacsi">Amaah Ganacsi</option>
                <option value="Amaah Guri">Amaah Guri</option>
                <option value="Amaah Baabuur">Amaah Baabuur</option>
                <option value="Amaah Waxbarasho">Amaah Waxbarasho</option>
              </select>
            </div>

            {/* Loan Amount */}
            <div className="form-group">
              <label className="form-label">Qaddarka Amaahda ($)</label>
              <input 
                type="number"
                name="loanAmount"
                value={formData.loanAmount}
                onChange={handleChange}
                placeholder="Geli qaddarka"
                className="form-input"
                required
              />
            </div>

            {/* Loan Term */}
            <div className="form-group">
              <label className="form-label">Muddada Amaahda</label>
              <select 
                name="loanTerm"
                value={formData.loanTerm}
                onChange={handleChange}
                className="form-select"
              >
                <option value="6 Bilood">6 Bilood</option>
                <option value="12 Bilood">12 Bilood</option>
                <option value="18 Bilood">18 Bilood</option>
                <option value="24 Bilood">24 Bilood</option>
                <option value="36 Bilood">36 Bilood</option>
                <option value="48 Bilood">48 Bilood</option>
                <option value="60 Bilood">60 Bilood</option>
              </select>
            </div>

            {/* Purpose of Loan */}
            <div className="form-group">
              <label className="form-label">Ujeedada Amaahda</label>
              <textarea 
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                placeholder="Maxaad u isticmaali doontaa amaahda?"
                className="form-textarea"
                required
              ></textarea>
            </div>

            {/* Submit Button */}
            <button type="submit" className="next-btn">
              TALLAABADA XIGTA
            </button>
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
