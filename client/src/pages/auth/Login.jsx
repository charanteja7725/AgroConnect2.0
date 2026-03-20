import React from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";

function Login() {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate("/role");
  };

  return (
    <div className="login-container">
      
      {/* LEFT SIDE */}
      <div className="login-left">
        <h1>AgroConnect 🌾</h1>
        <p>Connecting Farmers & Buyers Directly</p>
      </div>

      {/* RIGHT SIDE */}
      <div className="login-right">
        <h2>Login</h2>

        <input type="text" placeholder="Email or Phone" />
        <input type="password" placeholder="Password" />

        <button onClick={handleLogin}>Login</button>

        <p className="signup-text">
          Don't have an account? <span>Sign up</span>
        </p>
      </div>

    </div>
  );
}

export default Login;