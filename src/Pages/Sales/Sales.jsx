import React, { useState, useEffect, useMemo, useRef } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import { FaPlus, FaFileExport, FaFileExcel, FaSearch, FaTrash, FaSave, FaFilePdf, FaSpinner, FaEdit } from "react-icons/fa";
import Navbar from "../../Components/Sidebar/Navbar";
import "react-toastify/dist/ReactToastify.css";
import "./Sales.scss";
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import SalesPrint from "./SalesPrint";
import axios from "axios";

const Sales = () => {
  const [invoices, setInvoices] = useState([]);
  const [showForm, setShowForm] = useState(true);
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

  // Add new state near the top with other useState declarations:
  const [invoiceForPrint, setInvoiceForPrint] = useState(null); // { invoice, openWhatsapp }
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);


  // Fetch customers, products and invoices from backend
  useEffect(() => {
    fetchCustomers();
    fetchProducts();
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/invoices/get-invoices`);
      const invoicesData = (response.data && response.data.data) ? response.data.data : [];

      const sortedInvoices = invoicesData.sort((a, b) => {
        // Prefer createdAt if available, else use date
        const dateA = new Date(a.createdAt || a.date || 0);
        const dateB = new Date(b.createdAt || b.date || 0);

        if (dateB - dateA !== 0) return dateB - dateA;

        // fallback: compare numeric suffix of invoiceNumber (INVYYYYNNNN -> numeric part)
        const numA = parseInt((a.invoiceNumber || "").replace(/\D/g, "")) || 0;
        const numB = parseInt((b.invoiceNumber || "").replace(/\D/g, "")) || 0;
        return numB - numA;
      });

      setInvoices(sortedInvoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast.error("Failed to load invoices");
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    if (!invoiceForPrint) return;

    let mounted = true;

    const runPrint = async () => {
      try {
        // small delay to ensure the hidden component finished rendering
        await new Promise(resolve => setTimeout(resolve, 100));
        await generatePDF(invoiceForPrint.invoice);

        if (invoiceForPrint.openWhatsapp) {
          const customerMobile = (invoiceForPrint.invoice.customer?.mobile || "").replace(/\D/g, "");
          if (customerMobile) {
            const message = `Hello ${invoiceForPrint.invoice.customer?.name || ""}, your invoice (No: ${invoiceForPrint.invoice.invoiceNumber}) has been generated.`;
            window.open(`https://wa.me/${customerMobile}?text=${encodeURIComponent(message)}`, "_blank");
          }
        }
      } catch (err) {
        console.error("Error printing/opening whatsapp:", err);
      } finally {
        if (mounted) setInvoiceForPrint(null);
      }
    };

    runPrint();

    return () => { mounted = false; };
  }, [invoiceForPrint]); // runs when invoiceForPrint is set


  const fetchCustomers = async () => {
    try {
      setIsLoadingCustomers(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/customer/get-customers`);
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
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/products/get-products`);
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
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/invoices/create-invoice`, invoice);
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

  // Updated calculateInvoiceTotals function
  const calculateInvoiceTotals = () => {
    // Initialize all totals
    let subtotal = 0;
    let totalBaseValue = 0;
    let totalDiscountAmount = 0;
    let totalTaxAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;

    // Track tax percentages used
    const taxPercentages = new Set();

    // Process each item individually and calculate item-level values
    const itemsWithCalculations = selectedItems.map(item => {
      const quantity = item.quantity || 1;
      const taxRate = item.taxSlab || 18;
      const discountPercentage = item.discount || 0;

      // Track this tax percentage
      taxPercentages.add(taxRate);

      // Calculate original values (without discount)
      const itemSubtotal = item.price * quantity;

      // Calculate base value (excluding tax)
      const taxMultiplier = 1 + (taxRate / 100);
      const itemBaseValue = itemSubtotal / taxMultiplier;

      // Apply discount to base value
      const itemDiscountAmount = itemBaseValue * (discountPercentage / 100);

      // Calculate discounted base value
      const discountedBaseValue = itemBaseValue - itemDiscountAmount;

      // Calculate tax on discounted base value
      const itemTaxAmount = discountedBaseValue * (taxRate / 100);

      // Calculate CGST/SGST for this item
      const itemCgstAmount = itemTaxAmount / 2;
      const itemSgstAmount = itemTaxAmount / 2;

      // Calculate total amount for this item
      const itemTotalAmount = discountedBaseValue + itemTaxAmount;

      // Add to overall totals
      subtotal += itemSubtotal;
      totalBaseValue += itemBaseValue;
      totalDiscountAmount += itemDiscountAmount;
      totalTaxAmount += itemTaxAmount;

      // For same tax percentage items, calculate CGST/SGST
      if (taxPercentages.size === 1) {
        cgstAmount += itemCgstAmount;
        sgstAmount += itemSgstAmount;
      }

      // Return item with all calculated values
      return {
        ...item,
        baseValue: itemBaseValue,
        discountAmount: itemDiscountAmount,
        taxAmount: itemTaxAmount,
        cgstAmount: itemCgstAmount,
        sgstAmount: itemSgstAmount,
        totalAmount: itemTotalAmount
      };
    });

    // Check if we have mixed tax percentages
    const hasMixedTaxRates = taxPercentages.size > 1;

    // If mixed tax rates, don't split into CGST/SGST
    if (hasMixedTaxRates) {
      cgstAmount = 0;
      sgstAmount = 0;
    }

    // Calculate grand total
    const discountedBase = totalBaseValue - totalDiscountAmount;
    const grandTotal = discountedBase + totalTaxAmount;

    return {
      items: itemsWithCalculations,
      subtotal: subtotal,
      baseValue: totalBaseValue,
      discount: totalDiscountAmount,
      tax: totalTaxAmount,
      cgst: cgstAmount,
      sgst: sgstAmount,
      hasMixedTaxRates: hasMixedTaxRates,
      taxPercentages: Array.from(taxPercentages),
      grandTotal: grandTotal
    };
  };

  // Handle item selection
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
        originalPrice: product.price, // Store original price
        price: product.price, // Editable price field
        quantity: 1,
        discount: 0 // Changed from "" to 0
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
    } else if (field === 'price') {
      updatedItems[index][field] = value;
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
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/customer/create-customer`, {
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
        items: invoiceTotals.items.map(item => ({
          ...item,
          // Include both the original price and the potentially modified price
          originalPrice: item.originalPrice || item.price,
          price: item.price
        })),
        paymentType: values.paymentType,
        subtotal: invoiceTotals.subtotal,
        baseValue: invoiceTotals.baseValue,
        discount: invoiceTotals.discount,
        tax: invoiceTotals.tax,
        cgst: invoiceTotals.cgst,
        sgst: invoiceTotals.sgst,
        hasMixedTaxRates: invoiceTotals.hasMixedTaxRates,
        taxPercentages: invoiceTotals.taxPercentages,
        total: invoiceTotals.grandTotal
      };

      // Save to database
      // Save to database
      const savedInvoice = await saveInvoiceToDB(invoice);

      // Update local state safely (functional update)
      setInvoices(prev => {
        const updated = [savedInvoice.data, ...prev];
        // Re-sort to keep consistent ordering
        updated.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.date || 0);
          const dateB = new Date(b.createdAt || b.date || 0);
          if (dateB - dateA !== 0) return dateB - dateA;
          const numA = parseInt((a.invoiceNumber || "").replace(/\D/g, "")) || 0;
          const numB = parseInt((b.invoiceNumber || "").replace(/\D/g, "")) || 0;
          return numB - numA;
        });
        return updated;
      });
      setSelectedItems([]);
      setNewCustomer({ customerNumber: "", name: "", email: "", mobile: "" });
      setCustomerMobileSearch("");

      // Generate and download PDF
      setInvoiceForPrint({ invoice: savedInvoice.data, openWhatsapp: true });

      // toast.success("Invoice created successfully!"); 

      // ✅ Open WhatsApp with customer mobile
      const customerMobile = customerToUse.mobile.replace(/\D/g, ""); // remove non-numeric characters
      const message = `Hello ${customerToUse.name}, your invoice (No: ${savedInvoice.data.invoiceNumber}) has been generated.`;
      window.open(`https://wa.me/${customerMobile}?text=${encodeURIComponent(message)}`, "_blank");

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
    if (!invoice) return;
    if (isExporting) return;
    setIsExporting(true);

    try {
      const element = document.getElementById("sales-pdf");
      if (!element) {
        throw new Error("print element not found");
      }

      await html2pdf()
        .from(element)
        .set({
          filename: `${invoice.invoiceNumber}_${(invoice.customer?.name || "customer").replace(/\s+/g, "_")}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .save();
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export PDF");
      throw error;
    } finally {
      setIsExporting(false);
    }
  };

  // Add this near your other useMemo hooks
  const filteredInvoices = useMemo(() => {
    if (!searchTerm) return invoices;

    const term = searchTerm.toLowerCase();
    return invoices.filter(invoice =>
      (invoice.invoiceNumber && invoice.invoiceNumber.toLowerCase().includes(term)) ||
      (invoice.customer?.name && invoice.customer.name.toLowerCase().includes(term)) ||
      (invoice.customer?.mobile && invoice.customer.mobile.includes(term)) ||
      (invoice.paymentType && invoice.paymentType.toLowerCase().includes(term)) ||
      (invoice.total && invoice.total.toString().includes(term))
    );
  }, [searchTerm, invoices]);


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
        // 'Customer Number': invoice.customer.customerNumber, 
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

  const handleUpdateInvoice = async (updatedInvoice) => {
    try {
      const result = await updateInvoice(updatedInvoice);

      // Update local state with the returned data from server
      setInvoices(prev =>
        prev.map(inv =>
          inv.invoiceNumber === updatedInvoice.invoiceNumber ? result.data : inv
        )
      );

      toast.success("Invoice updated successfully!");
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast.error(error.response?.data?.message || "Error updating invoice");
    }
  };

  const handleDeleteInvoice = async (invoiceNumber) => {
    try {
      await deleteInvoice(invoiceNumber);

      // Update local state
      setInvoices(prev => prev.filter(inv => inv.invoiceNumber !== invoiceNumber));
      setSelectedInvoice(null);

      toast.success("Invoice deleted successfully!");
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast.error(error.response?.data?.message || "Error deleting invoice");
    }
  };

  // Update invoice in backend
  // Update invoice in backend
  // Update invoice in backend
  const updateInvoice = async (invoiceData) => {
    try {
      // Prepare only the fields that can be updated
      const updatePayload = {
        customer: {
          customerNumber: invoiceData.customer?.customerNumber,
          name: invoiceData.customer?.name,
          email: invoiceData.customer?.email,
          mobile: invoiceData.customer?.mobile // Now includes mobile
        },
        paymentType: invoiceData.paymentType
      };

      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/invoices/update-invoice/${invoiceData.invoiceNumber}`,
        updatePayload
      );
      return response.data;
    } catch (error) {
      console.error("Error updating invoice:", error);
      throw error;
    }
  };



  // Delete invoice from backend
  const deleteInvoice = async (invoiceNumber) => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/invoices/delete-invoice/${invoiceNumber}`
      );
    } catch (error) {
      console.error("Error deleting invoice:", error);
      throw error;
    }
  };

  const InvoiceModal = ({ invoice, onClose, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedInvoice, setEditedInvoice] = useState({});

    useEffect(() => {
      if (invoice) {
        setEditedInvoice({ ...invoice });
      }
    }, [invoice]);

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setEditedInvoice(prev => ({
        ...prev,
        customer: {
          ...prev.customer,
          [name]: value
        }
      }));
    };

    const handlePaymentTypeChange = (e) => {
      setEditedInvoice(prev => ({
        ...prev,
        paymentType: e.target.value
      }));
    };

    const handleSave = async () => {
      try {
        await onUpdate(editedInvoice);
        setIsEditing(false);
      } catch (error) {
        console.error("Error updating invoice:", error);
      }
    };

    if (!invoice) return null;

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              {isEditing ? "Edit Invoice" : `Invoice Details: ${invoice.invoiceNumber}`}
            </div>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="modal-body">
            <div className="wo-details-grid">
              {/* Invoice Number (Read-only) */}
              <div className="detail-row">
                <span className="detail-label">Invoice Number:</span>
                <span className="detail-value">{invoice.invoiceNumber}</span>
              </div>

              {/* Date (Read-only) */}
              <div className="detail-row">
                <span className="detail-label">Date:</span>
                <span className="detail-value">{invoice.date}</span>
              </div>

              {/* Customer Number */}
              {/* <div className="detail-row">
                <span className="detail-label">Customer Number:</span>
                {isEditing ? (
                  <input
                    type="text"
                    name="customerNumber"
                    value={editedInvoice.customer?.customerNumber || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                  />
                ) : (
                  <span className="detail-value">{invoice.customer?.customerNumber || 'N/A'}</span>
                )}
              </div> */}

              {/* Customer Name */}
              <div className="detail-row">
                <span className="detail-label">Customer Name:</span>
                {isEditing ? (
                  <input
                    type="text"
                    name="name"
                    value={editedInvoice.customer?.name || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                  />
                ) : (
                  <span className="detail-value">{invoice.customer?.name}</span>
                )}
              </div>

              {/* Customer Email */}
              <div className="detail-row">
                <span className="detail-label">Customer Email:</span>
                {isEditing ? (
                  <input
                    type="email"
                    name="email"
                    value={editedInvoice.customer?.email || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                  />
                ) : (
                  <span className="detail-value">{invoice.customer?.email || 'N/A'}</span>
                )}
              </div>

              {/* Customer Mobile - NOW EDITABLE */}
              <div className="detail-row">
                <span className="detail-label">Customer Mobile:</span>
                {isEditing ? (
                  <input
                    type="text"
                    name="mobile"
                    value={editedInvoice.customer?.mobile || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                  />
                ) : (
                  <span className="detail-value">{invoice.customer?.mobile}</span>
                )}
              </div>

              {/* Payment Type */}
              <div className="detail-row">
                <span className="detail-label">Payment Type:</span>
                {isEditing ? (
                  <select
                    value={editedInvoice.paymentType || ''}
                    onChange={handlePaymentTypeChange}
                    className="edit-input"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                  </select>
                ) : (
                  <span className="detail-value">{invoice.paymentType}</span>
                )}
              </div>

              {/* Total Amount (Read-only) */}
              <div className="detail-row">
                <span className="detail-label">Total Amount:</span>
                <span className="detail-value">₹{invoice.total?.toFixed(2)}</span>
              </div>

              {/* Items Count (Read-only) */}
              <div className="detail-row">
                <span className="detail-label">Items Count:</span>
                <span className="detail-value">{invoice.items?.length || 0}</span>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              className={`update-btn ${isEditing ? 'save-btn' : ''}`}
              onClick={isEditing ? handleSave : () => setIsEditing(true)}
            >
              {isEditing ? <FaSave /> : <FaEdit />}
              {isEditing ? "Save Changes" : "Update"}
            </button>
            <button
              className="delete-btn"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <FaTrash /> Delete
            </button>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="confirm-dialog-overlay">
            <div className="confirm-dialog">
              <h3>Confirm Deletion</h3>
              <p>Are you sure you want to delete invoice {invoice.invoiceNumber}? This action cannot be undone.</p>
              <div className="confirm-buttons">
                <button
                  className="confirm-cancel"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="confirm-delete"
                  onClick={() => {
                    onDelete(invoice.invoiceNumber);
                    setShowDeleteConfirm(false);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
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
                                <td>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.price || 0}
                                    onChange={(e) => handleItemUpdate(selectedItems.length - index - 1, 'price', parseFloat(e.target.value) || 0)}
                                    style={{ width: "80px" }} // Optional: to control the input width
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={item.discount || 0}
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

                          {/* Show tax breakdown based on tax percentages */}
                          {!invoiceTotals.hasMixedTaxRates && invoiceTotals.taxPercentages.length > 0 && (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span>CGST ({invoiceTotals.taxPercentages[0] / 2}%):</span>
                                <span>₹{invoiceTotals.cgst.toFixed(2)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span>SGST ({invoiceTotals.taxPercentages[0] / 2}%):</span>
                                <span>₹{invoiceTotals.sgst.toFixed(2)}</span>
                              </div>
                            </>
                          )}

                          {invoiceTotals.hasMixedTaxRates && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span>GST:</span>
                              <span>₹{invoiceTotals.tax.toFixed(2)}</span>
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
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                    {searchTerm ? 'No invoices match your search' : 'No invoices found. Create your first invoice.'}
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(invoice => (
                  // In the table row, modify the onClick handler
                  <tr
                    key={invoice.invoiceNumber}
                    onClick={(e) => {
                      // Check if the click came from the export button
                      if (e.target.closest('.export-pdf-btn')) {
                        return; // Don't open modal if export button was clicked
                      }
                      setSelectedInvoice(invoice);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{invoice.invoiceNumber}</td>
                    <td>{invoice.date}</td>
                    <td>{invoice.customer.name}</td>
                    <td>{invoice.items.length} items</td>
                    <td>{invoice.paymentType}</td>
                    <td>₹{invoice.total.toFixed(2)}</td>
                    <td>
                      <button
                        className="export-pdf-btn"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent the row click from firing
                          setInvoiceForPrint({ invoice, openWhatsapp: false });
                        }}
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

        {selectedInvoice && (
          <InvoiceModal
            invoice={selectedInvoice}
            onClose={() => setSelectedInvoice(null)}
            onUpdate={handleUpdateInvoice}
            onDelete={handleDeleteInvoice}
          />
        )}

        {/* Hidden PDF element */}
        <div style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden" }}>
          {invoiceForPrint && <SalesPrint invoice={invoiceForPrint.invoice} />}
        </div>
      </div>
    </Navbar>
  );
};

export default Sales;