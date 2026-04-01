import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoanApplication } from '../LoanApplicationContext';
import './LoanCalculator.css';

export default function LoanCalculator() {
  const [loanAmount, setLoanAmount] = useState(1000);
  const [loanTerm, setLoanTerm] = useState(12);
  const navigate = useNavigate();
  
  // Get context functions
  const { updateCalculatorData, updateLoanApplicationData } = useLoanApplication();

  // Calculate monthly payment (simple interest formula for demonstration)
  const calculateMonthlyPayment = () => {
    const interestRate = 0.18; // 18% annual interest
    const monthlyRate = interestRate / 12;
    const payment = (loanAmount * (1 + monthlyRate * loanTerm)) / loanTerm;
    return payment.toFixed(2);
  };
  
  const handleApplyNow = () => {
    // Save calculator data to context
    updateCalculatorData({
      loanAmount,
      loanTerm,
      monthlyPayment: calculateMonthlyPayment()
    });
    
    // Pre-fill loan application form with calculator values
    updateLoanApplicationData({
      loanAmount: loanAmount.toString(),
      loanTerm: `${loanTerm} Bilood`
    });
    
    navigate('/loan-application');
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <span className="logo-waafi">Waafi</span>
        </div>
        <button className="menu-btn" aria-label="Menu">
          <div className="menu-line"></div>
          <div className="menu-line"></div>
          <div className="menu-line"></div>
        </button>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="container">
          <h1 className="title">Hel Amaah Deg Deg ah</h1>
          <p className="subtitle">Ansixid degdeg ah • Qiimo tartan ah • Muddooyin dabacsan</p>

          {/* Loan Calculator */}
          <div className="calculator">
            <h2 className="calculator-title">Xisaabinta Amaahda</h2>
            
            {/* Loan Amount Slider */}
            <div className="input-group">
              <div className="input-header">
                <span className="input-label">Qaddarka Amaahda</span>
                <span className="input-value">${loanAmount.toLocaleString()}</span>
              </div>
              <input 
                type="range" 
                min="100" 
                max="5000" 
                step="50"
                value={loanAmount}
                onChange={(e) => setLoanAmount(Number(e.target.value))}
                className="slider"
              />
              <div className="range-labels">
                <span>$100</span>
                <span>$5,000</span>
              </div>
            </div>

            {/* Loan Term Slider */}
            <div className="input-group">
              <div className="input-header">
                <span className="input-label">Muddada Amaahda</span>
                <span className="input-value">{loanTerm} bilood</span>
              </div>
              <input 
                type="range" 
                min="6" 
                max="60" 
                value={loanTerm}
                onChange={(e) => setLoanTerm(Number(e.target.value))}
                className="slider"
              />
              <div className="range-labels">
                <span>6 bilood</span>
                <span>60 bilood</span>
              </div>
            </div>

            {/* Monthly Payment Display */}
            <div className="payment-box">
              <span className="payment-label">Lacagta Bisha</span>
              <span className="payment-amount">${Number(calculateMonthlyPayment()).toLocaleString()}</span>
            </div>
          </div>

          {/* Apply Button */}
          <button className="apply-btn" onClick={handleApplyNow}>CODSO HADDA</button>

          {/* Features */}
          <div className="features">
            <div className="feature">
              <div className="feature-icon">⚡</div>
              <div className="feature-title">Ansixid Degdeg ah</div>
              <div className="feature-subtitle">24 saac gudahood</div>
            </div>
            <div className="feature">
              <div className="feature-icon">💰</div>
              <div className="feature-title">Qiimo Yar</div>
              <div className="feature-subtitle">Laga bilaabo 18%</div>
            </div>
            <div className="feature">
              <div className="feature-icon">🔒</div>
              <div className="feature-title">Amaan ah</div>
              <div className="feature-subtitle">Heer banki</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        © 2025 Waafi Soomaaliya
      </footer>
    </div>
  );
}