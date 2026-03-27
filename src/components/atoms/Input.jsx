import React from 'react';

const Input = ({ type = 'text', placeholder, value, onChange, className = '', disabled=false, style={}, ...rest }) => {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`input-field ${className}`}
      disabled={disabled}
      style={style}
      {...rest}
    />
  );
};

export default Input;
