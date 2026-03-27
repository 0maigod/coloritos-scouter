import React from 'react';

const Button = ({ children, onClick, variant = 'primary', className = '', disabled=false, type="button" }) => {
  return (
    <button 
      type={type}
      onClick={onClick} 
      className={`btn btn-${variant} ${className}`}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default Button;
