import React, { useState, useEffect, useMemo, useRef } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import { FaPlus, FaFileExport, FaFileExcel, FaSearch, FaTrash, FaSave, FaFilePdf } from "react-icons/fa";
import Navbar from "../../Components/Sidebar/Navbar";
import "react-toastify/dist/ReactToastify.css";
import "./Sales.scss";
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import SalesPrint from "./SalesPrint";

// Dummy items data
const DUMMY_ITEMS = [
  { id: 1, barcode: "8901234567890", name: "Premium Steel Pipe", hsn: "73045900", price: 2000, taxSlab: 18 },
  { id: 2, barcode: "8901234567891", name: "Stainless Steel Sheet", hsn: "72191100", price: 850, taxSlab: 18 },
  { id: 3, barcode: "8901234567892", name: "Iron Rods", hsn: "72142000", price: 650, taxSlab: 18 },
  { id: 4, barcode: "8901234567893", name: "Aluminum Extrusion", hsn: "76042900", price: 5000, taxSlab: 18 },
  { id: 5, barcode: "8901234567894", name: "Copper Wire", hsn: "74081900", price: 950, taxSlab: 18 },
  { id: 6, barcode: "8901234567895", name: "Brass Fittings", hsn: "74122000", price: 780, taxSlab: 5 },
  { id: 7, barcode: "8901234567896", name: "Zinc Coating", hsn: "79070000", price: 520, taxSlab: 18 },
  { id: 8, barcode: "8901234567897", name: "Steel Nuts & Bolts", hsn: "73181500", price: 320, taxSlab: 18 },
  { id: 9, barcode: "8901234567898", name: "Steel Pipe", hsn: "73181544", price: 500, taxSlab: 5 },
  { id: 10, barcode: "8901234567899", name: "Galvanized Sheets", hsn: "72104100", price: 870, taxSlab: 18 },
];

// Dummy customers data with mobile numbers
const DUMMY_CUSTOMERS = [
  { id: 1, customerNumber: "CUST001", name: "Sharma Steel Works", email: "sharma@steel.com", mobile: "9876543210" },
  { id: 2, customerNumber: "CUST002", name: "Metal Craft Industries", email: "info@metalcraft.com", mobile: "8765432109" },
  { id: 3, customerNumber: "CUST003", name: "Precision Forge Ltd", email: "sales@precisionforge.com", mobile: "7654321098" },
  { id: 4, customerNumber: "CUST004", name: "Bharat Metal Works", email: "contact@bharatmetal.com", mobile: "6543210987" },
];

const Sales = () => {
  const [invoices, setInvoices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [customerMobileSearch, setCustomerMobileSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ 
    customerNumber: "", 
    name: "", 
    email: "",
    mobile: ""
  });
  const [isExporting, setIsExporting] = useState(false);
  const [customers, setCustomers] = useState(DUMMY_CUSTOMERS);
  const customerSearchRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter items based on search term
  const filteredItems = useMemo(() => {
    if (!itemSearchTerm) return [];
    
    const term = itemSearchTerm.toLowerCase();
    return DUMMY_ITEMS.filter(item => 
      item.name.toLowerCase().includes(term) || 
      item.hsn.toLowerCase().includes(term) ||
      item.barcode.includes(term) ||
      item.price.toString().includes(term)
    );
  }, [itemSearchTerm]);

  // Filter customers based on mobile search term
  const filteredCustomers = useMemo(() => {
    if (!customerMobileSearch) return [];
    
    const term = customerMobileSearch.toLowerCase();
    return customers.filter(customer => 
      customer.mobile.includes(term) || 
      customer.name.toLowerCase().includes(term)
    );
  }, [customerMobileSearch, customers]);

  // Calculate invoice totals based on new requirements
  const calculateInvoiceTotals = () => {
    // Step 1: Calculate subtotal (inclusive price × qty)
    const subtotal = selectedItems.reduce((sum, item) => {
      return sum + (item.price * (item.quantity || 1));
    }, 0);
    
    // Step 2: Break GST from subtotal for each item and calculate base value
    let totalBaseValue = 0;
    let totalTaxBeforeDiscount = 0;
    
    selectedItems.forEach(item => {
      const quantity = item.quantity || 1;
      const taxRate = item.taxSlab || 18;
      const taxMultiplier = 1 + (taxRate / 100);
      
      // Calculate base value for this item
      const itemBaseValue = (item.price * quantity) / taxMultiplier;
      totalBaseValue += itemBaseValue;
      
      // Calculate tax for this item
      const itemTax = (item.price * quantity) - itemBaseValue;
      totalTaxBeforeDiscount += itemTax;
    });
    
    // Step 3: Apply Discount (on base value) - now considering item-level discounts
    let totalDiscountAmount = 0;
    
    selectedItems.forEach(item => {
      const quantity = item.quantity || 1;
      const taxRate = item.taxSlab || 18;
      const taxMultiplier = 1 + (taxRate / 100);
      const discountPercentage = item.discount || 0;
      
      // Calculate base value for this item
      const itemBaseValue = (item.price * quantity) / taxMultiplier;
      
      // Calculate discount for this item
      const itemDiscountAmount = itemBaseValue * (discountPercentage / 100);
      totalDiscountAmount += itemDiscountAmount;
    });
    
    const discountedBase = totalBaseValue - totalDiscountAmount;
    
    // Step 4: Recalculate Tax (on discounted base)
    let totalTaxAfterDiscount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    
    selectedItems.forEach(item => {
      const taxRate = item.taxSlab || 18;
      const quantity = item.quantity || 1;
      const discountPercentage = item.discount || 0;
      const taxMultiplier = 1 + (taxRate / 100);
      
      // Calculate this item's portion of the base value
      const itemBaseValue = (item.price * quantity) / taxMultiplier;
      
      // Apply discount to this item
      const itemDiscountAmount = itemBaseValue * (discountPercentage / 100);
      const itemDiscountedBase = itemBaseValue - itemDiscountAmount;
      
      // Recalculate tax for this item
      const itemTaxAfterDiscount = itemDiscountedBase * (taxRate / 100);
      totalTaxAfterDiscount += itemTaxAfterDiscount;
      
      // Split tax into CGST and SGST (assuming equal split for GST)
      if (taxRate > 0) {
        cgstAmount += itemTaxAfterDiscount / 2;
        sgstAmount += itemTaxAfterDiscount / 2;
      }
    });
    
    // Step 5: Grand Total
    const grandTotal = discountedBase + totalTaxAfterDiscount;
    
    return {
      subtotal: subtotal,
      baseValue: totalBaseValue,
      discount: totalDiscountAmount,
      tax: totalTaxAfterDiscount,
      cgst: cgstAmount,
      sgst: sgstAmount,
      grandTotal: grandTotal
    };
  };

  // Handle item selection
  const handleItemSelect = (item) => {
    const existingItemIndex = selectedItems.findIndex(i => i.id === item.id);
    
    if (existingItemIndex >= 0) {
      // Item already exists, increase quantity
      const updatedItems = [...selectedItems];
      updatedItems[existingItemIndex].quantity = (updatedItems[existingItemIndex].quantity || 1) + 1;
      setSelectedItems(updatedItems);
    } else {
      // Add new item with default values
      setSelectedItems([...selectedItems, {
        ...item,
        quantity: 1,
        discount: 0
      }]);
    }
    
    setItemSearchTerm("");
  };

  // Handle item updates
  const handleItemUpdate = (index, field, value) => {
    const updatedItems = [...selectedItems];
    updatedItems[index][field] = value;
    setSelectedItems(updatedItems);
  };

  // Handle customer selection from dropdown
  const handleCustomerSelect = (customer) => {
    setNewCustomer({
      customerNumber: customer.customerNumber,
      name: customer.name,
      email: customer.email,
      mobile: customer.mobile
    });
    setCustomerMobileSearch(customer.mobile); // Set the mobile number in the search field
    setShowCustomerDropdown(false);
  };

  // Handle new customer creation
  const handleSaveCustomer = () => {
    if (!newCustomer.mobile || !newCustomer.name) {
      toast.error("Customer mobile and name are required");
      return;
    }
    
    // Check if customer already exists
    const existingCustomer = customers.find(c => c.mobile === newCustomer.mobile);
    
    if (!existingCustomer) {
      // Generate a new customer number
      const newCustomerNumber = `CUST${String(customers.length + 1).padStart(3, '0')}`;
      const customerToAdd = {
        ...newCustomer,
        id: customers.length + 1,
        customerNumber: newCustomerNumber
      };
      
      setCustomers([...customers, customerToAdd]);
      setNewCustomer({
        ...newCustomer,
        customerNumber: newCustomerNumber
      });
      toast.success("New customer added successfully!");
    } else {
      toast.info("Customer already exists");
    }
  };

  // Form initial values
  const initialValues = {
    paymentType: "cash"
  };

  // Validation schema
  const validationSchema = Yup.object().shape({
    paymentType: Yup.string().required("Payment type is required")
  });

  // Handle form submission
  const handleSubmit = (values) => {
    if (selectedItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    if (!newCustomer.mobile || !newCustomer.name) {
      toast.error("Customer mobile and name are required");
      return;
    }

    // Save customer if not already saved
    const existingCustomer = customers.find(c => c.mobile === newCustomer.mobile);
    if (!existingCustomer && newCustomer.name) {
      handleSaveCustomer();
    }

    const invoiceTotals = calculateInvoiceTotals();
    
    const invoice = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      invoiceNumber: `INV-${Date.now()}`,
      customer: newCustomer,
      items: selectedItems,
      paymentType: values.paymentType,
      subtotal: invoiceTotals.subtotal,
      baseValue: invoiceTotals.baseValue,
      discount: invoiceTotals.discount,
      tax: invoiceTotals.tax,
      cgst: invoiceTotals.cgst,
      sgst: invoiceTotals.sgst,
      total: invoiceTotals.grandTotal
    };

    setInvoices([invoice, ...invoices]);
    setSelectedItems([]);
    setNewCustomer({ customerNumber: "", name: "", email: "", mobile: "" });
    setCustomerMobileSearch("");
    
    // Generate PDF after submission
    generatePDF(invoice);
    
    toast.success("Invoice created successfully!");
  };

  // Generate PDF function
  const generatePDF = async (invoice) => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const element = document.getElementById("sales-pdf");

      // Wait for all images to load
      const images = element.getElementsByTagName("img");
      const imageLoadPromises = Array.from(images).map((img) => {
        return new Promise((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.onload = resolve;
            img.onerror = resolve;
          }
        });
      });

      await Promise.race([
        Promise.all(imageLoadPromises),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);

      // Generate PDF
      await html2pdf()
        .from(element)
        .set({
          filename: `${invoice.invoiceNumber}_${invoice.customer.name.replace(/\s+/g, "_")}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .save();
    } catch (error) {
      toast.error("Failed to export PDF");
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (invoices.length === 0) {
      toast.warn("No invoices to export");
      return;
    }

    const data = invoices.map((invoice) => {
      const itemsString = invoice.items.map(item => 
        `${item.name} (Qty: ${item.quantity})`
      ).join('; ');

      return {
        'Invoice ID': invoice.id,
        'Invoice Number': invoice.invoiceNumber,
        'Date': invoice.date,
        'Customer Number': invoice.customer.customerNumber,
        'Customer Name': invoice.customer.name,
        'Customer Email': invoice.customer.email,
        'Customer Mobile': invoice.customer.mobile,
        'Payment Type': invoice.paymentType,
        'Items Count': invoice.items.length,
        'Items Details': itemsString,
        'Total Amount': `₹${invoice.total.toFixed(2)}`
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");
    XLSX.writeFile(workbook, "invoices.xlsx");

    toast.success(`Exported ${invoices.length} invoices`);
  };

  const invoiceTotals = calculateInvoiceTotals();

  return (
    <Navbar>
      <ToastContainer position="top-center" autoClose={3000} />
      <div className="main">
        <div className="page-header">
          <h2>Tax Invoices</h2>
          <div className="right-section">
            <div className="search-container">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search Invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="action-buttons-group">
              <button className="export-all-btn" onClick={handleExportExcel}>
                <FaFileExcel /> Export All
              </button>
              <button className="add-btn" onClick={() => setShowForm(!showForm)}>
                <FaPlus /> {showForm ? "Close Form" : "Create Invoice"}
              </button>
            </div>
          </div>
        </div>

        {showForm && (
          <div className="form-container premium">
            <h2>Create Tax Invoice</h2>
            <Formik
              initialValues={initialValues}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              {({ values, setFieldValue }) => (
                <Form>
                  {/* Item Selection Section */}
                  <h3 className="section-heading">Item Details</h3>
                  <div className="form-group-row">
                    <div className="field-wrapper">
                      <label>Search Items</label>
                      <input
                        type="text"
                        placeholder="Search by name, HSN, barcode or price..."
                        value={itemSearchTerm}
                        onChange={(e) => setItemSearchTerm(e.target.value)}
                      />
                      {itemSearchTerm && filteredItems.length > 0 && (
                        <div className="search-dropdown">
                          {filteredItems.map(item => (
                            <div 
                              key={item.id} 
                              className="dropdown-item"
                              onClick={() => handleItemSelect(item)}
                            >
                              <div>{item.name}</div>
                              <div>HSN: {item.hsn} | Price: ₹{item.price} (incl. tax)</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedItems.length > 0 && (
                    <div>
                      <div className="items-table-container">
                        <table className="items-table">
                          <thead>
                            <tr>
                              <th width="5%">Sr No</th>
                              <th width="15%">Barcode</th>
                              <th width="25%">Product Name</th>
                              <th width="10%">HSN</th>
                              <th width="8%">Qty</th>
                              <th width="12%">Price (Incl. Tax)</th>
                              <th width="10%">Discount %</th>
                              <th width="15%">Total</th>
                              <th width="5%">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedItems.map((item, index) => (
                              <tr key={index}>
                                <td>{index + 1}</td>
                                <td>{item.barcode}</td>
                                <td>{item.name}</td>
                                <td>{item.hsn}</td>
                                <td>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => handleItemUpdate(index, 'quantity', parseInt(e.target.value) || 1)}
                                  />
                                </td>
                                <td>₹{item.price}</td>
                                <td>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={item.discount}
                                    onChange={(e) => handleItemUpdate(index, 'discount', parseInt(e.target.value) || 0)}
                                  />
                                </td>
                                <td>₹{(item.price * item.quantity).toFixed(2)}</td>
                                <td>
                                  <button 
                                    type="button" 
                                    className="remove-btn"
                                    onClick={() => setSelectedItems(selectedItems.filter((_, i) => i !== index))}
                                  >
                                    <FaTrash />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Calculation Summary - Now placed below the items table */}
                      <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '20px'}}>
                        <div style={{width: '300px', background: '#f9f9f9', padding: '15px', borderRadius: '8px'}}>
                          <h4 style={{marginTop: 0, borderBottom: '1px solid #ddd', paddingBottom: '10px'}}>Invoice Calculation</h4>
                          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                            <span>Subtotal (Incl. Tax):</span>
                            <span>₹{invoiceTotals.subtotal.toFixed(2)}</span>
                          </div>
                          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                            <span>Base Value:</span>
                            <span>₹{invoiceTotals.baseValue.toFixed(2)}</span>
                          </div>
                          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                            <span>Discount:</span>
                            <span>₹{invoiceTotals.discount.toFixed(2)}</span>
                          </div>
                          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                            <span>CGST (9%):</span>
                            <span>₹{invoiceTotals.cgst.toFixed(2)}</span>
                          </div>
                          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                            <span>SGST (9%):</span>
                            <span>₹{invoiceTotals.sgst.toFixed(2)}</span>
                          </div>
                          <div style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ddd', paddingTop: '10px', fontWeight: 'bold'}}>
                            <span>Grand Total:</span>
                            <span>₹{invoiceTotals.grandTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Customer Details Section */}
                  <h3 className="section-heading">Customer Details</h3>
                  <div className="form-group-row" ref={customerSearchRef}>
                    <div className="field-wrapper">
                      <label>Mobile Number *</label>
                      <input
                        type="text"
                        placeholder="Search by mobile number"
                        value={customerMobileSearch}
                        onChange={(e) => {
                          setCustomerMobileSearch(e.target.value);
                          setNewCustomer({...newCustomer, mobile: e.target.value});
                          setShowCustomerDropdown(e.target.value.length > 0);
                        }}
                        onFocus={() => setShowCustomerDropdown(customerMobileSearch.length > 0)}
                      />
                      {showCustomerDropdown && filteredCustomers.length > 0 && (
                        <div className="search-dropdown">
                          {filteredCustomers.map(customer => (
                            <div 
                              key={customer.id} 
                              className="dropdown-item"
                              onClick={() => handleCustomerSelect(customer)}
                            >
                              <div>{customer.mobile} - {customer.name}</div>
                              <div>{customer.email}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-group-row">
                    <div className="field-wrapper">
                      <label>Customer Name *</label>
                      <input
                        type="text"
                        placeholder="Enter customer name"
                        value={newCustomer.name}
                        onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                        required
                      />
                    </div>
                    <div className="field-wrapper">
                      <label>Email</label>
                      <input
                        type="email"
                        placeholder="Enter customer email"
                        value={newCustomer.email}
                        onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Payment Type Section */}
                  <h3 className="section-heading">Payment Type</h3>
                  <div className="payment-options-container">
                    <div className="payment-options">
                      <label className="payment-option">
                        <Field type="radio" name="paymentType" value="cash" />
                        <span className="payment-label">Cash</span>
                      </label>
                      <label className="payment-option">
                        <Field type="radio" name="paymentType" value="card" />
                        <span className="payment-label">Card</span>
                      </label>
                      <label className="payment-option">
                        <Field type="radio" name="paymentType" value="upi" />
                        <span className="payment-label">UPI</span>
                      </label>
                    </div>
                  </div>

                  <div className="submit-btn-container">
                    <button type="submit" className="submit-btn" disabled={isExporting}>
                      {isExporting ? "Generating PDF..." : "Create Invoice"}
                    </button>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        )}

        {/* Invoices Table */}
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Payment Type</th>
                <th>Total</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{textAlign: 'center', padding: '20px'}}>
                    No invoices found. Create your first invoice.
                  </td>
                </tr>
              ) : (
                invoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td>{invoice.invoiceNumber}</td>
                    <td>{invoice.date}</td>
                    <td>{invoice.customer.name}</td>
                    <td>{invoice.items.length} items</td>
                    <td>{invoice.paymentType}</td>
                    <td>₹{invoice.total.toFixed(2)}</td>
                    <td>
                      <button 
                        className="export-pdf-btn"
                        onClick={() => generatePDF(invoice)}
                        disabled={isExporting}
                      >
                        <FaFilePdf /> PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Hidden PDF element */}
        <div style={{ display: "none" }}>
          {invoices.length > 0 && <SalesPrint invoice={invoices[0]} />}
        </div>
      </div>
    </Navbar>
  );
};

export default Sales;