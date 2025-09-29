import React, { useState, useEffect } from "react";
import { useNavigate, NavLink } from "react-router-dom";

// Icon imports
import { BiLogOut, BiLayout, BiLogIn } from "react-icons/bi";
import { TbLayoutGridAdd, TbMessages, TbUsers } from "react-icons/tb";
import { LuCircleDot, LuFile } from "react-icons/lu";
import { PiBasket, PiLightbulbThin } from "react-icons/pi";
import { CiShoppingBasket } from "react-icons/ci";
import { HiOutlineHome } from "react-icons/hi";
import { BsBell } from "react-icons/bs";
import { GiHamburgerMenu } from "react-icons/gi";
import { RxCross1 } from "react-icons/rx";
import { FiUser } from "react-icons/fi"; // profile icon
import { MdDiscount } from "react-icons/md";

// import logo from "../../Assets/logo/jass_logo.jpg"
import logo from "../../Assets/logo/jass_logo_new.png"
// CSS
import "./Navbar.css";

const Navbar = ({ children }) => {
  const [toggle, setToggle] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userPermissions, setUserPermissions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const permissions = JSON.parse(localStorage.getItem("permissions") || "[]");
    setIsLoggedIn(!!token);
    setUserPermissions(permissions);
  }, []);

  const handleLogin = () => {
    navigate("/login");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("permissions");
    localStorage.removeItem("user");
    setIsLoggedIn(false);
    setUserPermissions([]);
    navigate("/login");
  };

  // Define all possible menu items with their required permissions
  const allMenuData = [
    { icon: <PiBasket />, title: "Invoice", path: "/", permission: "invoice" },
    // { icon: <HiOutlineHome />, title: "Dashboard", path: "/dashboard", permission: "dashboard" },
    { icon: <TbUsers />, title: "Customer", path: "/customer", permission: "customer" },
    // { icon: <CiShoppingBasket />, title: "Vendor", path: "/vendor", permission: "vendor" },
    { icon: <LuFile />, title: "Products", path: "/items", permission: "products" },
    { icon: <TbUsers />, title: "Admin", path: "/admin", permission: "admin" },
    { icon: <MdDiscount  />, title: "Discount", path: "/productdiscount", permission: "discount" }, 
    // { icon: <TbLayoutGridAdd />, title: "Purchase Order", path: "/purchase-order", permission: "purchase" },
    // { icon: <BsBell />, title: "GRN", path: "/grn", permission: "grn" },
    // { icon: <PiLightbulbThin />, title: "BOM", path: "/bom", permission: "bom" },
    // { icon: <LuCircleDot />, title: "Work Order", path: "/work-order", permission: "workorder" },
    { icon: <BiLayout />, title: "Inventory", path: "/inventory", permission: "inventory" },  
    { icon: <TbMessages />, title: "Product Disposal", path: "/defective", permission: "disposal" },
    // { icon: <TbMessages />, title: "Report", path: "/report", permission: "report" },
  ];

  // Filter menu items based on user permissions
  const getFilteredMenu = () => {
    // If user has admin permission, show all menu items
    if (userPermissions.includes("admin")) {
      return allMenuData;
    }
    
    // Otherwise, filter menu items based on user's permissions
    return allMenuData.filter(item => 
      userPermissions.includes(item.permission)
    );
  };

  const filteredMenuData = getFilteredMenu();

  return (
    <>
      <div id="sidebar" className={toggle ? "hide" : ""}>
        <div className="logo">
          <div className="logoBox">
            {toggle ? (
              <GiHamburgerMenu
                className="menuIconHidden"
                onClick={() => setToggle(false)}
              />
            ) : (
              <>
                {/* Show logo instead of text */}
                <img src={logo} alt="Logo" className="sidebar-logo" />
                <RxCross1
                  className="menuIconHidden"
                  onClick={() => setToggle(true)}
                />
              </>
            )}
          </div>
        </div>

        <ul className="side-menu top">
          {filteredMenuData.map(({ icon, title, path }, i) => (
            <li key={i}>
              <NavLink
                to={path}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                <span className="menu-icon">{icon}</span>
                <span className="menu-title">{title}</span>
              </NavLink>
            </li>
          ))}

          {isLoggedIn && (
            <li className="logout-menu-item">
              <button className="sidebar-logout-btn" onClick={handleLogout}>
                <BiLogOut />
                <span>Logout</span>
              </button>
            </li>
          )}
        </ul>
      </div>

      <div id="content">
        <nav>
          <div>
            <GiHamburgerMenu
              className="menuIcon"
              onClick={() => setToggle(!toggle)}
            />
          </div>
          <div>
            {!isLoggedIn ? (
              <button className="icon-button" onClick={handleLogin} title="Login">
                <BiLogIn />
              </button>
            ) : (
              <div className="profile">
                {/* profile icon instead of image */}
                <div className="profile-icon" title="Account">
                  <FiUser />
                </div>
                <button className="icon-button" onClick={handleLogout} title="Logout">
                  <BiLogOut />
                </button>
              </div>
            )}
          </div>
        </nav>
        {children}
      </div>
    </>
  );
};

export default Navbar;