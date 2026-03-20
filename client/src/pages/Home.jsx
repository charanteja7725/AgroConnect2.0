import React from "react";
import { useNavigate } from "react-router-dom";
import { FaMicrophone, FaSearch, FaTruck } from "react-icons/fa";
import { MdOutlineAgriculture } from "react-icons/md";
import { FiShoppingCart } from "react-icons/fi";
import "./home.css";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home">

      {/* NAVBAR */}
      <div className="navbar">
        <div className="logo">
          <MdOutlineAgriculture size={20} />
          <span>AgroConnect</span>
        </div>

        <div className="nav-buttons">
          <button onClick={() => navigate("/login")}>Login</button>
          <button className="register">Register</button>
        </div>
      </div>

      {/* HERO */}
      <div className="hero">
        <div className="overlay">
          <div className="hero-content">

            <div className="mic">
              <FaMicrophone />
            </div>

            <h1>Voice Assisted Farmer-to-Consumer Marketplace</h1>

            <p>
              Connecting farmers directly with consumers. Simple, accessible, and powered by voice technology.
            </p>

            {/* SEARCH BAR */}
            <div className="search-box">
              <select>
                <option>All Areas</option>
              </select>

              <input placeholder="Search fresh vegetables, fruits, grains..." />

              <span className="mic-icon">
                <FaMicrophone />
              </span>

              <button className="search-btn">
                <FaSearch />
              </button>
            </div>

         <button 
  className="start-btn" 
  onClick={() => navigate("/roles")}
>
  Get Started
</button>

          </div>
        </div>
      </div>

      {/* WHO WE SERVE */}
      <div className="serve">
        <h2>Who We Serve</h2>

        <div className="cards">

          {/* FARMERS */}
          <div className="card green">
            <div className="card-icon">
              <MdOutlineAgriculture size={24} />
            </div>
            <h3>For Farmers</h3>
            <ul>
              <li>List products with voice commands</li>
              <li>Manage orders easily</li>
              <li>Track earnings</li>
            </ul>
          </div>

          {/* CUSTOMERS */}
          <div className="card orange">
            <div className="card-icon">
              <FiShoppingCart size={24} />
            </div>
            <h3>For Customers</h3>
            <ul>
              <li>Browse fresh produce nearby</li>
              <li>Compare prices easily</li>
              <li>Order with a few taps</li>
            </ul>
          </div>

          {/* DELIVERY */}
          <div className="card blue">
            <div className="card-icon">
              <FaTruck size={24} />
            </div>
            <h3>For Delivery Partners</h3>
            <ul>
              <li>Accept delivery requests</li>
              <li>Update delivery status</li>
              <li>Earn by delivering</li>
            </ul>
          </div>

        </div>
      </div>

      {/* STEPS SECTION */}
      <div className="steps">
        <h2>Simple & Accessible</h2>

        <div className="step-container">

          <div className="step">
            <div className="circle">1</div>
            <h4>Choose Your Role</h4>
            <p>Farmer, Customer, or Delivery Partner</p>
          </div>

          <div className="step">
            <div className="circle">2</div>
            <h4>Use Voice or Text</h4>
            <p>Easy input with voice assistance</p>
          </div>

          <div className="step">
            <div className="circle">3</div>
            <h4>Start Trading</h4>
            <p>Buy, sell, or deliver with ease</p>
          </div>

        </div>
      </div>

      {/* FOOTER */}
      <div className="footer">
        <p>AgroConnect</p>
        <span>Empowering farmers, serving customers</span>
      </div>

    </div>
  );
}

export default Home;