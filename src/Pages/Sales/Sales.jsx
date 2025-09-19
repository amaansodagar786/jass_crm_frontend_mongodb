import React, { useState, useEffect, useMemo, useRef } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import { FaPlus, FaFileExport, FaFileExcel, FaSearch, FaTrash, FaSave, FaFilePdf, FaSpinner } from "react-icons/fa";
import Navbar from "../../Components/Sidebar/Navbar";
import "react-toastify/dist/ReactToastify.css";
import "./Sales.scss";
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import SalesPrint from "./SalesPrint";
import axios from "axios";

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
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const customerSearchRef = useRef(null);

  // Fetch customers, products and invoices from backend
  useEffect(() => {
    fetchCustomers();
    fetchProducts();
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get("http://localhost:5000/invoices/get-invoices");
      setInvoices(response.data.data);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast.error("Failed to load invoices");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      setIsLoadingCustomers(true);
      const response = await axios.get("http://localhost:5000/customer/get-customers");
      const customersData = response.data.map(customer => ({
        id: customer.customerId,
        customerNumber: customer.customerId,
        name: customer.customerName || "",
        email: customer.email || "",
        mobile: customer.contactNumber || ""
      }));
      setCustomers(customersData);
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("Failed to load customers");
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const fetchProducts = async () => {
    try {
      setIsLoadingProducts(true);
      const response = await axios.get("http://localhost:5000/products/get-products");
      setProducts(response.data);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Save invoice to database
  const saveInvoiceToDB = async (invoice) => {
    try {
      const response = await axios.post("http://localhost:5000/invoices/create-invoice", invoice);
      return response.data;
    } catch (error) {
      console.error("Error saving invoice to database:", error);
      throw error;
    }
  };

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

  // Filter products based on search term
  const filteredProducts = useMemo(() => {
    if (!itemSearchTerm) return [];

    const term = itemSearchTerm.toLowerCase();
    return products.filter(product =>
      (product.productName && product.productName.toLowerCase().includes(term)) ||
      (product.hsnCode && product.hsnCode.toLowerCase().includes(term)) ||
      (product.barcode && product.barcode.includes(term)) ||
      (product.price && product.price.toString().includes(term))
    );
  }, [itemSearchTerm, products]);

  // Filter customers based on mobile search term
  const filteredCustomers = useMemo(() => {
    if (!customerMobileSearch) return [];

    const term = customerMobileSearch.toLowerCase();
    return customers.filter(customer =>
      (customer.mobile && customer.mobile.includes(term)) ||
      (customer.name && customer.name.toLowerCase().includes(term))
    );
  }, [customerMobileSearch, customers]);

  // Calculate invoice totals based on new requirements
  // Updated calculateInvoiceTotals function
  // Updated calculateInvoiceTotals function
  const calculateInvoiceTotals = () => {
    // Initialize all totals
    let subtotal = 0;
    let totalBaseValue = 0;
    let totalDiscountAmount = 0;
    let totalTaxAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let otherTaxAmount = 0;
    let has18PercentItems = false;
    let hasOtherTaxItems = false;

    // Process each item individually
    selectedItems.forEach(item => {
      const quantity = item.quantity || 1;
      const taxRate = item.taxSlab || 18;
      const discountPercentage = item.discount || 0;

      // Calculate original values (without discount)
      const itemSubtotal = item.price * quantity;
      subtotal += itemSubtotal;

      // Calculate base value (excluding tax)
      const taxMultiplier = 1 + (taxRate / 100);
      const itemBaseValue = itemSubtotal / taxMultiplier;
      totalBaseValue += itemBaseValue;

      // Apply discount to base value
      const itemDiscountAmount = itemBaseValue * (discountPercentage / 100);
      totalDiscountAmount += itemDiscountAmount;

      // Calculate discounted base value
      const discountedBaseValue = itemBaseValue - itemDiscountAmount;

      // Calculate tax on discounted base value
      const itemTaxAmount = discountedBaseValue * (taxRate / 100);
      totalTaxAmount += itemTaxAmount;

      // Allocate tax to appropriate buckets
      if (taxRate === 18) {
        has18PercentItems = true;
        cgstAmount += itemTaxAmount / 2;
        sgstAmount += itemTaxAmount / 2;
      } else {
        hasOtherTaxItems = true;
        otherTaxAmount += itemTaxAmount;
      }
    });

    // Calculate grand total
    const discountedBase = totalBaseValue - totalDiscountAmount;
    const grandTotal = discountedBase + totalTaxAmount;

    return {
      subtotal: subtotal,
      baseValue: totalBaseValue,
      discount: totalDiscountAmount,
      tax: totalTaxAmount,
      cgst: cgstAmount,
      sgst: sgstAmount,
      otherTax: otherTaxAmount,
      has18PercentItems: has18PercentItems,
      hasOtherTaxItems: hasOtherTaxItems,
      grandTotal: grandTotal
    };
  };

  // Handle item selection
  const handleItemSelect = (product) => {
    const existingItemIndex = selectedItems.findIndex(i => i.productId === product.productId);

    if (existingItemIndex >= 0) {
      // Item already exists, increase quantity
      const updatedItems = [...selectedItems];
      updatedItems[existingItemIndex].quantity = (updatedItems[existingItemIndex].quantity || 1) + 1;
      setSelectedItems(updatedItems);
    } else {
      // Add new item with default values
      setSelectedItems([...selectedItems, {
        ...product,
        id: product.productId, // Keep id for backward compatibility
        name: product.productName, // Map productName to name
        hsn: product.hsnCode, // Map hsnCode to hsn
        quantity: 1,
        discount: ""
      }]);
    }

    setItemSearchTerm("");
  };

  // Handle item updates
  const handleItemUpdate = (index, field, value) => {
    const updatedItems = [...selectedItems];

    // For discount field, keep it as string to allow empty value
    if (field === 'discount') {
      updatedItems[index][field] = value === "" ? "" : parseInt(value) || 0;
    } else {
      updatedItems[index][field] = value;
    }

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

  // Create new customer in backend
  const createCustomer = async (customerData) => {
    try {
      const response = await axios.post("http://localhost:5000/customer/create-customer", {
        customerName: customerData.name,
        email: customerData.email,
        contactNumber: customerData.mobile
      });

      return {
        id: response.data.customerId,
        customerNumber: response.data.customerId,
        name: response.data.customerName,
        email: response.data.email,
        mobile: response.data.contactNumber
      };
    } catch (error) {
      console.error("Error creating customer:", error);
      throw error;
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
  const handleSubmit = async (values) => {
    if (selectedItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    if (!newCustomer.mobile || !newCustomer.name) {
      toast.error("Customer mobile and name are required");
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if customer already exists in our database
      const existingCustomer = customers.find(c => c.mobile === newCustomer.mobile);

      let customerToUse = { ...newCustomer };

      // If customer doesn't exist, create it in the backend
      if (!existingCustomer) {
        try {
          const createdCustomer = await createCustomer(newCustomer);
          customerToUse = createdCustomer;
          // Add the new customer to our local state
          setCustomers([...customers, createdCustomer]);
          toast.success("New customer created successfully!");
        } catch (error) {
          if (error.response && error.response.data && error.response.data.field === "email") {
            toast.error("Customer with this email already exists. Please use a different email.");
          } else {
            toast.error("Failed to create customer. Please try again.");
          }
          setIsSubmitting(false);
          return;
        }
      } else {
        customerToUse = existingCustomer;
      }

      const invoiceTotals = calculateInvoiceTotals();

      const invoice = {
        date: new Date().toISOString().split('T')[0],
        customer: customerToUse,
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

      // Save to database
      const savedInvoice = await saveInvoiceToDB(invoice);

      // Update local state with the invoice from database (which includes the invoiceNumber)
      setInvoices([savedInvoice.data, ...invoices]);
      setSelectedItems([]);
      setNewCustomer({ customerNumber: "", name: "", email: "", mobile: "" });
      setCustomerMobileSearch("");

      // Generate PDF after submission with the actual invoice number from backend
      generatePDF(savedInvoice.data);

      toast.success("Invoice created successfully!");
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast.error("Failed to create invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate PDF function
  const generatePDF = async (invoice) => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      // Create a temporary element for PDF generation
      const tempElement = document.createElement("div");
      tempElement.innerHTML = document.getElementById("sales-pdf").innerHTML;

      // Update the invoice number in the temporary element
      const invoiceNumberElement = tempElement.querySelector(".invoice-number");
      if (invoiceNumberElement && invoice.invoiceNumber) {
        invoiceNumberElement.textContent = `Invoice Number: ${invoice.invoiceNumber}`;
      }

      document.body.appendChild(tempElement);

      // Wait for all images to load
      const images = tempElement.getElementsByTagName("img");
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
        .from(tempElement)
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

      // Clean up
      document.body.removeChild(tempElement);
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
                      <label>Search Products</label>
                      <input
                        type="text"
                        placeholder="Search by name, HSN, barcode or price..."
                        value={itemSearchTerm}
                        onChange={(e) => setItemSearchTerm(e.target.value)}
                      />
                      {isLoadingProducts && (
                        <div className="search-dropdown">
                          <div className="dropdown-item">Loading products...</div>
                        </div>
                      )}
                      {itemSearchTerm && !isLoadingProducts && filteredProducts.length > 0 && (
                        <div className="search-dropdown">
                          {filteredProducts.map(product => (
                            <div
                              key={product.productId}
                              className="dropdown-item"
                              onClick={() => handleItemSelect(product)}
                            >
                              <div>{product.productName}</div>
                              <div>HSN: {product.hsnCode || "N/A"} | Price: ₹{product.price || 0} (incl. tax)</div>
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
                            {selectedItems.slice().reverse().map((item, index) => (
                              <tr key={selectedItems.length - index - 1}>
                                <td>{selectedItems.length - index}</td>
                                <td>{item.barcode || "N/A"}</td>
                                <td>{item.name}</td>
                                <td>{item.hsn || "N/A"}</td>
                                <td>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => handleItemUpdate(selectedItems.length - index - 1, 'quantity', parseInt(e.target.value) || 1)}
                                  />
                                </td>
                                <td>₹{item.price || 0}</td>
                                <td>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={item.discount}
                                    onChange={(e) => handleItemUpdate(selectedItems.length - index - 1, 'discount', parseInt(e.target.value) || 0)}
                                  />
                                </td>
                                <td>₹{((item.price || 0) * item.quantity).toFixed(2)}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="invoice-remove-btn"
                                    onClick={() => {
                                      const actualIndex = selectedItems.length - index - 1;
                                      setSelectedItems(selectedItems.filter((_, i) => i !== actualIndex));
                                    }}
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
                      {/* Calculation Summary */}
                      {/* Calculation Summary */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                        <div style={{ width: '350px', background: '#f9f9f9', padding: '15px', borderRadius: '8px' }}>
                          <h4 style={{ marginTop: 0, borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Invoice Calculation</h4>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span>Subtotal (Incl. Tax):</span>
                            <span>₹{invoiceTotals.subtotal.toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span>Base Value (Excl. Tax):</span>
                            <span>₹{invoiceTotals.baseValue.toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span>Total Discount:</span>
                            <span>₹{invoiceTotals.discount.toFixed(2)}</span>
                          </div>

                          {/* Show tax breakdown based on what items are present */}
                          {invoiceTotals.has18PercentItems && (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span>CGST (9%):</span>
                                <span>₹{invoiceTotals.cgst.toFixed(2)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span>SGST (9%):</span>
                                <span>₹{invoiceTotals.sgst.toFixed(2)}</span>
                              </div>
                            </>
                          )}

                          {invoiceTotals.hasOtherTaxItems && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span>Other Tax:</span>
                              <span>₹{invoiceTotals.otherTax.toFixed(2)}</span>
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold' }}>
                            <span>Total Tax:</span>
                            <span>₹{invoiceTotals.tax.toFixed(2)}</span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ddd', paddingTop: '10px', fontWeight: 'bold' }}>
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
                          setNewCustomer({ ...newCustomer, mobile: e.target.value });
                          setShowCustomerDropdown(e.target.value.length > 0);
                        }}
                        onFocus={() => setShowCustomerDropdown(customerMobileSearch.length > 0)}
                      />
                      {isLoadingCustomers && (
                        <div className="search-dropdown">
                          <div className="dropdown-item">Loading customers...</div>
                        </div>
                      )}
                      {showCustomerDropdown && !isLoadingCustomers && filteredCustomers.length > 0 && (
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
                        onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="field-wrapper">
                      <label>Email</label>
                      <input
                        type="email"
                        placeholder="Enter customer email"
                        value={newCustomer.email}
                        onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
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
                    <button type="submit" className="submit-btn" disabled={isSubmitting || isExporting}>
                      {isSubmitting ? (
                        <>
                          <FaSpinner className="spinner" /> Creating Invoice...
                        </>
                      ) : isExporting ? (
                        "Generating PDF..."
                      ) : (
                        "Create Invoice"
                      )}
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
              {isLoading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                    No invoices found. Create your first invoice.
                  </td>
                </tr>
              ) : (
                invoices.map(invoice => (
                  <tr key={invoice.invoiceNumber}>
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