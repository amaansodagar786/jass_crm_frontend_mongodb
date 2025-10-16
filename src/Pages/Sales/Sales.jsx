import React, { useState, useEffect, useMemo, useRef } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import { FaPlus, FaFileExport, FaFileExcel, FaSearch, FaTrash, FaSave, FaFilePdf, FaSpinner, FaEdit, FaChevronDown } from "react-icons/fa";
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
    mobile: "",
    date: new Date().toISOString().split('T')[0],
    remarks: ""
  });
  const [isExporting, setIsExporting] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBatchDropdown, setShowBatchDropdown] = useState(null);
  const customerSearchRef = useRef(null);
  const batchDropdownRef = useRef(null);

  const [invoiceForPrint, setInvoiceForPrint] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState("");
  const [categories, setCategories] = useState([]);

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [isBulkImportLoading, setIsBulkImportLoading] = useState(false);

  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [promoError, setPromoError] = useState("");


  // Add this function to validate promo code
  // Update the validatePromoCode function in Sales component
  const validatePromoCode = async (code) => {
    if (!code.trim()) {
      setPromoError("Please enter a promo code");
      return false;
    }

    setIsValidatingPromo(true);
    setPromoError("");

    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/promoCodes/validate-promo/${code.trim().toUpperCase()}`
      );

      if (response.data.isValid) {
        setAppliedPromo(response.data.promoCode);
        setPromoError("");
        toast.success(`Promo code applied! ${response.data.promoCode.discount}% discount`);
        return true;
      } else {
        // Check the specific error message from backend
        const errorMessage = response.data.message || "Invalid promo code";

        if (errorMessage.includes("inactive")) {
          setPromoError("This promo code is currently inactive");
          toast.error("Promo code is inactive");
        } else if (errorMessage.includes("expired")) {
          setPromoError("This promo code has expired");
          toast.error("Promo code has expired");
        } else if (errorMessage.includes("Invalid") || errorMessage.includes("invalid")) {
          setPromoError("Invalid promo code. Please check the spelling");
          toast.error("Invalid promo code. Please check the spelling");
        } else {
          setPromoError(errorMessage);
          toast.error(errorMessage);
        }

        setAppliedPromo(null);
        return false;
      }
    } catch (error) {
      console.error("Error validating promo code:", error);

      // Handle specific HTTP status codes
      if (error.response?.status === 404) {
        setPromoError("Promo code not found. Please check the spelling");
        toast.error("Promo code not found. Please check the spelling");
      } else if (error.response?.status === 400) {
        setPromoError("Invalid promo code format");
        toast.error("Invalid promo code format");
      } else {
        setPromoError("Failed to validate promo code. Please try again.");
        toast.error("Failed to validate promo code");
      }

      setAppliedPromo(null);
      return false;
    } finally {
      setIsValidatingPromo(false);
    }
  };

  // Add this function to remove applied promo
  const removePromoCode = () => {
    setAppliedPromo(null);
    setPromoCode("");
    setPromoError("");
    toast.info("Promo code removed");
  };

  // Fetch all data on component mount
  useEffect(() => {
    fetchCustomers();
    fetchProducts();
    fetchInventory();
    fetchInvoices();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
      }
      if (batchDropdownRef.current && !batchDropdownRef.current.contains(event.target)) {
        setShowBatchDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Add this useEffect after your other useEffects
  useEffect(() => {
    if (!invoiceForPrint) return;

    const generatePDFAndHandleWhatsApp = async () => {
      try {
        // Wait for the SalesPrint component to render with new data
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Generate PDF
        await generatePDF(invoiceForPrint.invoice);

        // Open WhatsApp if needed
        if (invoiceForPrint.openWhatsapp) {
          const customerMobile = (invoiceForPrint.invoice.customer?.mobile || "").replace(/\D/g, "");
          if (customerMobile) {
            const message = `Hello ${invoiceForPrint.invoice.customer?.name || ""}, your invoice (No: ${invoiceForPrint.invoice.invoiceNumber}) has been generated.`;
            window.open(`https://wa.me/${customerMobile}?text=${encodeURIComponent(message)}`, "_blank");
          }
        }
      } catch (error) {
        console.error("Error in PDF/WhatsApp process:", error);
        toast.error("Failed to generate PDF");
      } finally {
        setInvoiceForPrint(null);
      }
    };

    generatePDFAndHandleWhatsApp();
  }, [invoiceForPrint]);

  useEffect(() => {
    const uniqueCategories = [...new Set(products.map(product => product.category).filter(Boolean))];
    setCategories(uniqueCategories);
  }, [products]);

  // Fetch functions
  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/invoices/get-invoices`);
      const invoicesData = (response.data && response.data.data) ? response.data.data : [];

      const sortedInvoices = invoicesData.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.date || 0);
        const dateB = new Date(b.createdAt || b.date || 0);
        if (dateB - dateA !== 0) return dateB - dateA;
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

  const fetchCustomers = async () => {
    try {
      setIsLoadingCustomers(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/customer/get-customers`);
      const customersData = response.data.map(customer => ({
        customerId: customer.customerId,
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

  const fetchInventory = async () => {
    try {
      setIsLoadingInventory(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/inventory/get-inventory`);

      // FIX: Extract the data array from response
      setInventory(response.data.data || []);

    } catch (error) {
      console.error("Error fetching inventory:", error);
      toast.error("Failed to load inventory data");
    } finally {
      setIsLoadingInventory(false);
    }
  };

  // Batch management functions
  // Batch management functions
  const getAvailableBatches = (productId) => {
    const inventoryItem = inventory.find(item => item.productId === productId);
    if (!inventoryItem) return [];

    const currentDate = new Date();

    return inventoryItem.batches
      .filter(batch => {
        const isExpired = new Date(batch.expiryDate) < currentDate;
        return batch.quantity > 0 && !isExpired;
      })
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate)) // Sort by expiry date (earliest first)
      .map(batch => ({
        ...batch,
        productId: inventoryItem.productId,
        productName: inventoryItem.productName,
        category: inventoryItem.category
      }));
  };


  const getAvailableQuantity = (productId, batchNumber) => {
    const inventoryItem = inventory.find(item => item.productId === productId);
    if (!inventoryItem) return 0;

    const batch = inventoryItem.batches.find(b => b.batchNumber === batchNumber);
    return batch ? batch.quantity : 0;
  };

  const handleProductSelect = (product) => {
    const availableBatches = getAvailableBatches(product.productId);

    // Check if all batches are expired
    const inventoryItem = inventory.find(item => item.productId === product.productId);
    const hasExpiredBatches = inventoryItem && inventoryItem.batches.some(batch => {
      const isExpired = new Date(batch.expiryDate) < new Date();
      return batch.quantity > 0 && isExpired;
    });

    if (availableBatches.length === 0) {
      if (hasExpiredBatches) {
        toast.error("All batches for this product are expired");
      } else {
        toast.error("No available stock for this product");
      }
      setItemSearchTerm(""); // Clear search term
      return;
    }

    if (availableBatches.length === 1) {
      handleBatchSelect(availableBatches[0]);
      setItemSearchTerm(""); // Clear search term after selection
    } else {
      setShowBatchDropdown(product.productId);
      setItemSearchTerm(""); // Clear search term
    }
  };

  // Update the handleBatchSelect function
  const handleBatchSelect = (batch) => {
    const existingItemIndex = selectedItems.findIndex(i =>
      i.productId === batch.productId && i.batchNumber === batch.batchNumber
    );

    if (existingItemIndex >= 0) {
      const updatedItems = [...selectedItems];
      const availableQty = getAvailableQuantity(batch.productId, batch.batchNumber);

      if (updatedItems[existingItemIndex].quantity >= availableQty) {
        toast.error(`Only ${availableQty} items available in this batch`);
        return;
      }

      updatedItems[existingItemIndex].quantity += 1;
      setSelectedItems(updatedItems);
    } else {
      const product = products.find(p => p.productId === batch.productId);
      setSelectedItems([...selectedItems, {
        productId: batch.productId,
        id: batch.productId,
        name: batch.productName,
        category: batch.category,
        hsn: product?.hsnCode || "",
        barcode: product?.barcode || "",
        originalPrice: product?.price || 0,
        price: product?.price || 0,
        quantity: 1,
        discount: product?.discount || 0,
        taxSlab: product?.taxSlab || 18, // ✅ ADD THIS LINE
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate
      }]);
    }

    setShowBatchDropdown(null);
    setItemSearchTerm("");
  };



  // Item management
  const handleItemUpdate = (index, field, value) => {
    const updatedItems = [...selectedItems];

    if (field === 'quantity') {
      const item = updatedItems[index];
      const availableQty = getAvailableQuantity(item.productId, item.batchNumber);

      if (value > availableQty) {
        toast.error(`Only ${availableQty} items available in this batch`);
        return;
      }

      updatedItems[index][field] = value === "" ? "" : parseInt(value) || 0;
    } else if (field === 'discount') {
      updatedItems[index][field] = value === "" ? "" : parseInt(value) || 0;
    } else if (field === 'price') {
      updatedItems[index][field] = value;
    } else {
      updatedItems[index][field] = value;
    }

    setSelectedItems(updatedItems);
  };

  // Customer management
  const handleCustomerSelect = (customer) => {
    setNewCustomer({
      customerNumber: customer.customerNumber,
      name: customer.name,
      email: customer.email,
      mobile: customer.mobile,
      date: newCustomer.date,
      remarks: newCustomer.remarks
    });
    setCustomerMobileSearch(customer.mobile);
    setShowCustomerDropdown(false);
  };

  const createCustomer = async (customerData) => {
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/customer/create-customer`, {
        customerName: customerData.name,
        email: customerData.email,
        contactNumber: customerData.mobile,
        loyaltyCoins: 0
      });

      return {
        id: response.data.customerId,
        customerId: response.data.customerId || response.data.id,
        customerNumber: response.data.customerId,
        name: response.data.customerName,
        email: response.data.email,
        mobile: response.data.contactNumber,
        loyaltyCoins: 0
      };
    } catch (error) {
      console.error("Error creating customer:", error);
      throw error;
    }
  };

  // CORRECT calculateInvoiceTotals function - Tax calculated AFTER promo discount
  const calculateInvoiceTotals = () => {
    let subtotal = 0;
    let totalDiscountAmount = 0;
    let totalBaseValue = 0;
    let totalTaxAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    const taxPercentages = new Set();

    // First calculate amount after all discounts
    let amountAfterAllDiscounts = 0;

    const itemsWithCalculations = selectedItems.map(item => {
      const quantity = item.quantity || 1;
      const taxRate = item.taxSlab || 18;
      const discountPercentage = item.discount || 0;

      taxPercentages.add(taxRate);

      // Price already includes tax
      const itemTotalInclTax = item.price * quantity;
      const itemDiscountAmount = itemTotalInclTax * (discountPercentage / 100);
      const itemTotalAfterDiscount = itemTotalInclTax - itemDiscountAmount;

      subtotal += itemTotalInclTax;
      totalDiscountAmount += itemDiscountAmount;
      amountAfterAllDiscounts += itemTotalAfterDiscount;

      return {
        ...item,
        discountAmount: itemDiscountAmount,
        totalAmount: itemTotalAfterDiscount
      };
    });

    // ✅ Apply promo discount on the total amount after item discounts
    let promoDiscountAmount = 0;
    if (appliedPromo) {
      promoDiscountAmount = amountAfterAllDiscounts * (appliedPromo.discount / 100);
    }

    // ✅ Final amount after ALL discounts
    const finalAmountAfterAllDiscounts = amountAfterAllDiscounts - promoDiscountAmount;

    // ✅ NOW calculate tax on the final amount after ALL discounts
    const itemsWithTaxCalculations = itemsWithCalculations.map(item => {
      const taxRate = item.taxSlab || 18;

      // Calculate tax based on final discounted amount for this item
      const itemFinalAmount = (item.totalAmount / amountAfterAllDiscounts) * finalAmountAfterAllDiscounts;
      const itemBaseValue = itemFinalAmount / (1 + taxRate / 100);
      const itemTaxAmount = itemFinalAmount - itemBaseValue;
      const itemCgstAmount = taxPercentages.size === 1 ? itemTaxAmount / 2 : 0;
      const itemSgstAmount = taxPercentages.size === 1 ? itemTaxAmount / 2 : 0;

      totalBaseValue += itemBaseValue;
      totalTaxAmount += itemTaxAmount;
      cgstAmount += itemCgstAmount;
      sgstAmount += itemSgstAmount;

      return {
        ...item,
        baseValue: itemBaseValue,
        taxAmount: itemTaxAmount,
        cgstAmount: itemCgstAmount,
        sgstAmount: itemSgstAmount,
        finalAmount: itemFinalAmount
      };
    });

    const hasMixedTaxRates = taxPercentages.size > 1;
    if (hasMixedTaxRates) {
      cgstAmount = 0;
      sgstAmount = 0;
    }

    // ✅ Final grand total (amount after ALL discounts)
    const grandTotal = finalAmountAfterAllDiscounts;

    return {
      items: itemsWithTaxCalculations,
      subtotal: subtotal,
      baseValue: totalBaseValue,
      discount: totalDiscountAmount,
      promoDiscount: promoDiscountAmount,
      tax: totalTaxAmount,
      cgst: cgstAmount,
      sgst: sgstAmount,
      hasMixedTaxRates: hasMixedTaxRates,
      taxPercentages: Array.from(taxPercentages),
      amountAfterAllDiscounts: amountAfterAllDiscounts,
      finalAmountAfterAllDiscounts: finalAmountAfterAllDiscounts,
      grandTotal: grandTotal
    };
  };

  // Add this function in your Sales component
  const calculateLoyaltyCoins = (invoiceTotals) => {
    // Use baseValue which is total after discounts but before tax
    const spendAmount = invoiceTotals.baseValue;

    // Calculate coins: 1 coin per 100 rupees, rounded down
    let coins = Math.floor(spendAmount / 100);

    // Apply maximum limit of 50 coins per order
    coins = Math.min(coins, 50);

    return coins;
  };


  // Add this function in your Sales component (after the createCustomer function)
  const updateCustomerLoyaltyCoins = async (customerId, coinsEarned) => {
    try {
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/customer/update-loyalty-coins/${customerId}`,
        { coinsEarned }
      );
      return response.data;
    } catch (error) {
      console.error("Error updating customer loyalty coins:", error);
      throw error;
    }
  };


  // Form submission
  const handleSubmit = async (values) => {
    const hasInvalidQuantity = selectedItems.some(item =>
      !item.quantity || item.quantity === "" || item.quantity < 1
    );

    if (selectedItems.length === 0 || hasInvalidQuantity) {
      toast.error("Please add at least one item and ensure all quantities are valid (minimum 1)");
      return;
    }

    if (!newCustomer.mobile || !newCustomer.name) {
      toast.error("Customer mobile and name are required");
      return;
    }

    const mobileRegex = /^\d{10}$/;
    if (!mobileRegex.test(newCustomer.mobile)) {
      toast.error("Please enter a valid 10-digit mobile number (numbers only)");
      return;
    }

    // Validate quantities against available stock
    for (const item of selectedItems) {
      const availableQty = getAvailableQuantity(item.productId, item.batchNumber);
      if (item.quantity > availableQty) {
        toast.error(`Only ${availableQty} items available for ${item.name} (Batch: ${item.batchNumber})`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const existingCustomer = customers.find(c => c.mobile === newCustomer.mobile);
      let customerToUse = { ...newCustomer };

      if (!existingCustomer) {
        try {
          const createdCustomer = await createCustomer(newCustomer);
          customerToUse = createdCustomer;
          setCustomers([...customers, createdCustomer]);
          toast.success("New customer created successfully!");
        } catch (error) {
          if (error.response?.data?.field === "email") {
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

      const loyaltyCoinsEarned = calculateLoyaltyCoins(invoiceTotals);

      const invoice = {
        date: newCustomer.date || new Date().toISOString().split('T')[0],
        customer: customerToUse,
        items: invoiceTotals.items.map(item => ({
          ...item,
          originalPrice: item.originalPrice || item.price,
          price: item.price,
          category: item.category
        })),
        paymentType: values.paymentType,
        subtotal: invoiceTotals.subtotal,
        baseValue: invoiceTotals.baseValue,
        discount: invoiceTotals.discount,
        promoDiscount: invoiceTotals.promoDiscount, // Add this
        appliedPromoCode: appliedPromo ? { // Add this
          promoId: appliedPromo.promoId,
          code: appliedPromo.code,
          discount: appliedPromo.discount,
          description: appliedPromo.description
        } : null,
        tax: invoiceTotals.tax,
        cgst: invoiceTotals.cgst,
        sgst: invoiceTotals.sgst,
        hasMixedTaxRates: invoiceTotals.hasMixedTaxRates,
        taxPercentages: invoiceTotals.taxPercentages,
        total: invoiceTotals.grandTotal,
        remarks: newCustomer.remarks || '',
        loyaltyCoinsEarned: loyaltyCoinsEarned
      };

      const savedInvoice = await saveInvoiceToDB(invoice);
      // await updateInventoryQuantities(selectedItems); 

      if (loyaltyCoinsEarned > 0) {
        await updateCustomerLoyaltyCoins(customerToUse.customerId, loyaltyCoinsEarned);
      }

      setInvoices(prev => {
        const updated = [savedInvoice.data, ...prev];
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

      await fetchInventory();
      setSelectedItems([]);
      setNewCustomer({
        customerNumber: "",
        name: "",
        email: "",
        mobile: "",
        date: new Date().toISOString().split('T')[0],
        remarks: ""
      });
      setCustomerMobileSearch("");

      setPromoCode("");
      setAppliedPromo(null);
      setPromoError("");

      setInvoiceForPrint({ invoice: savedInvoice.data, openWhatsapp: true });

      const customerMobile = customerToUse.mobile.replace(/\D/g, "");
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

  // Database operations
  const saveInvoiceToDB = async (invoice) => {
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/invoices/create-invoice`, invoice);
      return response.data;
    } catch (error) {
      console.error("Error saving invoice to database:", error);
      throw error;
    }
  };

  const updateInvoice = async (invoiceData) => {
    try {
      const updatePayload = {
        customer: {
          customerId: invoiceData.customer?.customerId,
          customerNumber: invoiceData.customer?.customerNumber,
          name: invoiceData.customer?.name,
          email: invoiceData.customer?.email,
          mobile: invoiceData.customer?.mobile
        },
        paymentType: invoiceData.paymentType,
        remarks: invoiceData.remarks || ''
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

  // PDF generation
  const generatePDF = async (invoice) => {
    if (!invoice) return;
    if (isExporting) return;
    setIsExporting(true);

    try {
      // Wait a bit more to ensure the hidden element is rendered
      await new Promise(resolve => setTimeout(resolve, 500));

      const element = document.getElementById("sales-pdf");
      if (!element) {
        console.error("PDF element not found, retrying...");
        // Try one more time after a delay
        await new Promise(resolve => setTimeout(resolve, 500));
        const retryElement = document.getElementById("sales-pdf");
        if (!retryElement) {
          throw new Error("PDF print element not found after retry");
        }
      }

      const addFooterToEachPage = (pdf) => {
        const totalPages = pdf.internal.getNumberOfPages();
        const pageHeight = pdf.internal.pageSize.getHeight();

        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "italic");
          pdf.setTextColor(100, 100, 100);

          const pageWidth = pdf.internal.pageSize.getWidth();
          const text = "THIS IS A COMPUTER GENERATED BILL";
          const textWidth = pdf.getTextWidth(text);
          const xPosition = (pageWidth - textWidth) / 2;
          const yPosition = pageHeight - 10;

          pdf.text(text, xPosition, yPosition);
          pdf.setDrawColor(200, 200, 200);
          pdf.line(15, yPosition - 3, pageWidth - 15, yPosition - 3);
        }

        return pdf;
      };

      const opt = {
        filename: `${invoice.invoiceNumber}_${(invoice.customer?.name || "customer").replace(/\s+/g, "_")}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait"
        },
        pagebreak: {
          mode: ['css', 'legacy'],
          avoid: ['tr', '.invoice-footer']
        },
        margin: [0, 0, 20, 0]
      };

      await html2pdf()
        .set(opt)
        .from(element)
        .toPdf()
        .get('pdf')
        .then((pdf) => {
          return addFooterToEachPage(pdf);
        })
        .save();

      console.log("PDF generated successfully");

    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export PDF");
      throw error;
    } finally {
      setIsExporting(false);
    }
  };

  // Excel export - UPDATED VERSION with complete calculations
  const handleExportExcel = () => {
    if (invoices.length === 0) {
      toast.warn("No invoices to export");
      return;
    }

    const data = invoices.flatMap((invoice) => {
      // Filter items based on category filter
      let filteredItems = invoice.items || [];

      if (categoryFilter) {
        filteredItems = filteredItems.filter(item =>
          item.category === categoryFilter
        );
      }

      // If no items after filtering and we have a category filter, skip this invoice
      if (categoryFilter && filteredItems.length === 0) {
        return [];
      }

      if (filteredItems.length === 0) {
        return [{
          'Invoice Number': invoice.invoiceNumber,
          'Date': invoice.date,
          'Customer Name': invoice.customer?.name || '',
          'Customer Email': invoice.customer?.email || '',
          'Customer Mobile': invoice.customer?.mobile || '',
          'Payment Type': invoice.paymentType,
          'Remarks': invoice.remarks || '',
          'Subtotal': `₹${invoice.subtotal?.toFixed(2) || '0.00'}`,
          'Total Discount': `₹${invoice.discount?.toFixed(2) || '0.00'}`,
          'CGST Amount': `₹${invoice.cgst?.toFixed(2) || '0.00'}`,
          'SGST Amount': `₹${invoice.sgst?.toFixed(2) || '0.00'}`,
          'Total Tax': `₹${invoice.tax?.toFixed(2) || '0.00'}`,
          'Grand Total': `₹${invoice.total?.toFixed(2) || '0.00'}`,
          'Items Count': 0,
          'Item Name': 'No items',
          'HSN Code': 'N/A',
          'Batch Number': 'N/A',
          'Category': 'N/A',
          'Quantity': 0,
          'Price': 0,
          'Item Total': '0.00'
        }];
      }

      return filteredItems.map((item, index) => {
        // Calculate item total for export
        const itemTotal = (item.price || 0) * (item.quantity || 0);
        const itemDiscountAmount = itemTotal * ((item.discount || 0) / 100);
        const itemTotalAfterDiscount = itemTotal - itemDiscountAmount;

        return {
          'Invoice Number': invoice.invoiceNumber,
          'Date': invoice.date,
          'Customer Name': invoice.customer?.name || '',
          'Customer Email': invoice.customer?.email || '',
          'Customer Mobile': invoice.customer?.mobile || '',
          'Payment Type': invoice.paymentType,
          'Remarks': invoice.remarks || '',
          'Subtotal': `₹${invoice.subtotal?.toFixed(2) || '0.00'}`,
          'Total Discount': `₹${invoice.discount?.toFixed(2) || '0.00'}`,
          'CGST Amount': `₹${invoice.cgst?.toFixed(2) || '0.00'}`,
          'SGST Amount': `₹${invoice.sgst?.toFixed(2) || '0.00'}`,
          'Total Tax': `₹${invoice.tax?.toFixed(2) || '0.00'}`,
          'Grand Total': `₹${invoice.total?.toFixed(2) || '0.00'}`,
          'Items Count': filteredItems.length,
          'Item Name': item.name || item.productName || 'Unknown',
          'HSN Code': item.hsn || item.hsnCode || 'N/A',
          'Batch Number': item.batchNumber || 'N/A',
          'Category': item.category || 'N/A',
          'Quantity': item.quantity || 0,
          'Price': `₹${(item.price || 0).toFixed(2)}`,
          'Discount %': `${item.discount || 0}%`,
          'Item Total': `₹${itemTotalAfterDiscount.toFixed(2)}`
        };
      });
    });

    if (data.length === 0) {
      toast.warn(`No invoices found with category: ${categoryFilter}`);
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");

    const fileName = categoryFilter
      ? `invoices_${categoryFilter.replace(/\s+/g, '_')}.xlsx`
      : "invoices.xlsx";

    XLSX.writeFile(workbook, fileName);

    const invoiceCount = new Set(data.map(item => item['Invoice Number'])).size;
    toast.success(`Exported ${invoiceCount} invoices with ${data.length} item rows${categoryFilter ? ` (Filtered by: ${categoryFilter})` : ''}`);
  };

  const handleUpdateInvoice = async (updatedInvoice) => {
    try {
      const result = await updateInvoice(updatedInvoice);
      setInvoices(prev =>
        prev.map(inv =>
          inv.invoiceNumber === updatedInvoice.invoiceNumber ? { ...inv, ...result.data } : inv
        )
      );
      setSelectedInvoice(prev => prev ? { ...prev, ...result.data } : null);
      toast.success("Invoice updated successfully!");
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast.error(error.response?.data?.message || "Error updating invoice");
    }
  };

  const handleDeleteInvoice = async (invoiceNumber) => {
    try {
      await deleteInvoice(invoiceNumber);
      setInvoices(prev => prev.filter(inv => inv.invoiceNumber !== invoiceNumber));
      setSelectedInvoice(null);
      toast.success("Invoice deleted successfully!");
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast.error(error.response?.data?.message || "Error deleting invoice");
    }
  };

  // Filter functions
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

  const filteredCustomers = useMemo(() => {
    if (!customerMobileSearch) return [];
    const term = customerMobileSearch.toLowerCase();
    return customers.filter(customer =>
      (customer.mobile && customer.mobile.includes(term)) ||
      (customer.name && customer.name.toLowerCase().includes(term))
    );
  }, [customerMobileSearch, customers]);

  // Filter functions - UPDATED VERSION
  const filteredInvoices = useMemo(() => {
    if (!searchTerm && !categoryFilter) return invoices;

    let filtered = invoices;

    // Apply category filter first
    if (categoryFilter) {
      filtered = filtered.filter(invoice => {
        // Check if any item in the invoice matches the selected category
        return invoice.items?.some(item => item.category === categoryFilter);
      });
    }

    // Apply search term filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(invoice =>
        (invoice.invoiceNumber && invoice.invoiceNumber.toLowerCase().includes(term)) ||
        (invoice.customer?.name && invoice.customer.name.toLowerCase().includes(term)) ||
        (invoice.customer?.mobile && invoice.customer.mobile.includes(term)) ||
        (invoice.paymentType && invoice.paymentType.toLowerCase().includes(term)) ||
        (invoice.total && invoice.total.toString().includes(term))
      );
    }

    return filtered;
  }, [searchTerm, invoices, categoryFilter]);


  // Bulk import function - Groups items by invoice
  const handleBulkImport = async (file) => {
    try {
      setIsBulkImportLoading(true);

      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            toast.error("No data found in the file");
            setIsBulkImportLoading(false);
            return;
          }

          console.log("Raw Excel data:", jsonData[0]); // Debug first row

          // Group rows by invoice number
          const invoicesMap = new Map();

          jsonData.forEach((row, index) => {
            const invoiceNumber = row['Invoice Number'];

            if (!invoiceNumber) {
              console.warn(`Skipping row ${index + 1}: No invoice number`);
              return;
            }

            if (!invoicesMap.has(invoiceNumber)) {
              // Create new invoice structure with ALL fields from Excel
              invoicesMap.set(invoiceNumber, {
                invoiceNumber: invoiceNumber,
                date: row['Date'] || new Date().toISOString().split('T')[0],
                customer: {
                  customerId: row['Customer ID'] || `CUST-${invoiceNumber}`,
                  customerNumber: row['Customer ID'] || `CUST-${invoiceNumber}`,
                  name: row['Customer Name'] || '',
                  email: row['Customer Email'] || '',
                  mobile: row['Customer Mobile'] || ''
                },
                items: [],
                paymentType: row['Payment Type'] || 'cash',
                // IMPORTANT: Read all calculation fields from Excel
                subtotal: parseFloat(row['Subtotal']) || 0,
                baseValue: parseFloat(row['Base Value']) || 0,
                discount: parseFloat(row['Total Discount']) || 0,
                tax: parseFloat(row['Total Tax']) || 0,
                cgst: parseFloat(row['CGST']) || 0,
                sgst: parseFloat(row['SGST']) || 0,
                total: parseFloat(row['Grand Total']) || 0,
                hasMixedTaxRates: row['Has Mixed Tax Rates'] === 'Yes',
                taxPercentages: row['Tax Percentages'] ?
                  row['Tax Percentages'].toString().split(',').map(p => parseFloat(p.trim())).filter(n => !isNaN(n)) : [],
                remarks: row['Remarks'] || '',
                createdAt: row['Created At'] ? new Date(row['Created At']) : new Date(),
                updatedAt: row['Updated At'] ? new Date(row['Updated At']) : new Date()
              });
            }

            // Add item to the invoice if it has valid item data
            const currentInvoice = invoicesMap.get(invoiceNumber);
            if (row['Item Name'] && row['Item Name'] !== 'No items') {
              const newItem = {
                productId: row['Item Product ID'] || `PROD-${invoiceNumber}-${index}`,
                name: row['Item Name'],
                barcode: row['Item Barcode'] || '',
                hsn: row['Item HSN'] || row['HSN Code'] || '',
                category: row['Item Category'] || row['Category'] || '',
                price: parseFloat(row['Item Price']) || 0,
                taxSlab: parseFloat(row['Item Tax Slab']) || 18,
                quantity: parseInt(row['Item Quantity']) || 1,
                discount: parseFloat(row['Item Discount %']) || 0,
                batchNumber: row['Item Batch Number'] || 'DEFAULT',
                expiryDate: row['Item Expiry Date'] || null,
                // IMPORTANT: Read all item calculation fields
                baseValue: parseFloat(row['Item Base Value']) || 0,
                discountAmount: parseFloat(row['Item Discount Amount']) || 0,
                taxAmount: parseFloat(row['Item Tax Amount']) || 0,
                cgstAmount: parseFloat(row['Item CGST Amount']) || 0,
                sgstAmount: parseFloat(row['Item SGST Amount']) || 0,
                totalAmount: parseFloat(row['Item Total Amount']) || 0
              };

              currentInvoice.items.push(newItem);
            }
          });

          const invoicesToImport = Array.from(invoicesMap.values());

          console.log(`Processed ${invoicesToImport.length} invoices with multiple items`);

          // Debug: Check if data is properly read
          if (invoicesToImport.length > 0) {
            const sampleInvoice = invoicesToImport[0];
            console.log("Sample invoice data:", {
              invoiceNumber: sampleInvoice.invoiceNumber,
              subtotal: sampleInvoice.subtotal,
              cgst: sampleInvoice.cgst,
              sgst: sampleInvoice.sgst,
              taxPercentages: sampleInvoice.taxPercentages,
              hasMixedTaxRates: sampleInvoice.hasMixedTaxRates,
              items: sampleInvoice.items.map(item => ({
                name: item.name,
                cgstAmount: item.cgstAmount,
                sgstAmount: item.sgstAmount
              }))
            });
          }

          // Send to backend
          const response = await fetch(
            `${import.meta.env.VITE_API_URL}/invoices/bulk-import-invoices`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ invoices: invoicesToImport }),
            }
          );

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.message || "Failed to import invoices");
          }

          // Show detailed results
          const totalInvoices = invoicesToImport.length;
          const totalItems = invoicesToImport.reduce((sum, inv) => sum + inv.items.length, 0);

          toast.success(
            `Import completed: ${result.results.successful.length}/${totalInvoices} invoices successful, ${totalItems} total items`
          );

          // Refresh invoices list
          if (result.results.successful.length > 0) {
            await fetchInvoices();
          }

          // Log failed imports for debugging
          if (result.results.failed.length > 0) {
            console.warn("Failed imports:", result.results.failed);
            toast.info(`${result.results.failed.length} invoices failed to import. Check console for details.`);
          }

          setShowBulkImport(false);

        } catch (error) {
          console.error("Error processing file:", error);
          toast.error(error.message || "Error processing the file");
        } finally {
          setIsBulkImportLoading(false);
        }
      };

      reader.onerror = () => {
        toast.error("Error reading file");
        setIsBulkImportLoading(false);
      };

      reader.readAsArrayBuffer(file);

    } catch (error) {
      console.error("Error in bulk import:", error);
      toast.error("Failed to import invoices");
      setIsBulkImportLoading(false);
    }
  };

  // Modal component
  const InvoiceModal = ({ invoice, onClose, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedInvoice, setEditedInvoice] = useState({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
      if (invoice) {
        setEditedInvoice({ ...invoice });
      }
    }, [invoice]);

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      if (name === "remarks") {
        setEditedInvoice(prev => ({
          ...prev,
          remarks: value
        }));
      } else {
        setEditedInvoice(prev => ({
          ...prev,
          customer: {
            ...prev.customer,
            [name]: value
          }
        }));
      }
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


    const calculateInvoiceBreakdown = (invoice) => {
      const subtotal = invoice.subtotal || 0;
      const itemDiscount = invoice.discount || 0;
      const promoDiscount = invoice.promoDiscount || 0;
      const tax = invoice.tax || 0;

      const amountBeforeTax = subtotal - itemDiscount;
      const taxableAmountAfterPromo = amountBeforeTax - promoDiscount;
      const grandTotal = taxableAmountAfterPromo;

      return {
        subtotal,
        itemDiscount,
        promoDiscount,
        amountBeforeTax,
        taxableAmountAfterPromo,
        tax,
        grandTotal
      };
    };

    const invoiceBreakdown = calculateInvoiceBreakdown(invoice);

    // Calculate item totals for display
    const calculateItemTotal = (item) => {
      const quantity = item.quantity || 1;
      const price = item.price || 0;
      const discount = item.discount || 0;

      const totalBeforeDiscount = price * quantity;
      const discountAmount = totalBeforeDiscount * (discount / 100);
      return totalBeforeDiscount - discountAmount;
    };

    if (!invoice) return null;

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content invoice-modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              {isEditing ? "Edit Invoice" : `Invoice Details: ${invoice.invoiceNumber}`}
            </div>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="modal-body">
            {/* Basic Invoice Information */}
            <div className="invoice-section">
              <h3 className="section-title">Basic Information</h3>
              <div className="wo-details-grid">
                <div className="detail-row">
                  <span className="detail-label">Invoice Number:</span>
                  <span className="detail-value">{invoice.invoiceNumber}</span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Date:</span>
                  <span className="detail-value">{invoice.date}</span>
                </div>

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

                <div className="detail-row">
                  <span className="detail-label">Remarks:</span>
                  {isEditing ? (
                    <textarea
                      name="remarks"
                      value={editedInvoice.remarks || ''}
                      onChange={(e) => setEditedInvoice(prev => ({
                        ...prev,
                        remarks: e.target.value
                      }))}
                      className="edit-input"
                      rows={3}
                      style={{ width: '100%', resize: 'vertical' }}
                      placeholder="Optional remarks..."
                    />
                  ) : (
                    <span className="detail-value">{invoice.remarks || 'No remarks'}</span>
                  )}
                </div>


                {invoice.appliedPromoCode && (
                  <div className="detail-row">
                    <span className="detail-label">Promo Code Applied:</span>
                    <span className="detail-value promo-code-value">
                      {invoice.appliedPromoCode.code} - {invoice.appliedPromoCode.discount}% off
                      {invoice.appliedPromoCode.description && (
                        <div className="promo-description">{invoice.appliedPromoCode.description}</div>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Items Details Section */}
            <div className="invoice-section">
              <h3 className="section-title">Items Details ({invoice.items?.length || 0} items)</h3>
              {invoice.items && invoice.items.length > 0 ? (
                <div className="items-table-container">
                  <table className="items-details-table">
                    <thead>
                      <tr>
                        <th width="5%">Sr No</th>
                        <th width="20%">Product Name</th>
                        <th width="10%">HSN Code</th>
                        <th width="10%">Category</th>
                        <th width="10%">Batch No</th>
                        <th width="8%">Qty</th>
                        <th width="12%">Price</th>
                        <th width="10%">Discount %</th>
                        <th width="15%">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item, index) => (
                        <tr key={`${item.productId}-${item.batchNumber}-${index}`}>
                          <td>{index + 1}</td>
                          <td>
                            <div className="product-name">{item.name}</div>
                            {item.barcode && (
                              <div className="product-barcode">Barcode: {item.barcode}</div>
                            )}
                          </td>
                          <td>{item.hsn || "N/A"}</td>
                          <td>
                            <span className="category-tag">{item.category || "N/A"}</span>
                          </td>
                          <td>
                            <div className="batch-info">
                              <span className="batch-tag">{item.batchNumber || "N/A"}</span>
                              {item.expiryDate && (
                                <div className="expiry-date">
                                  Exp: {new Date(item.expiryDate).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>{item.quantity || 0}</td>
                          <td>₹{(item.price || 0).toFixed(2)}</td>
                          <td>{item.discount || 0}%</td>
                          <td className="amount-cell">₹{calculateItemTotal(item).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-items-message">No items found in this invoice</div>
              )}
            </div>



            {/* Invoice Summary Section */}
            <div className="invoice-section">
              <h3 className="section-title">Invoice Calculation Breakdown</h3>
              <div className="invoice-summary-grid detailed-calculation">
                <div className="calculation-step">
                  <span className="step-label">Subtotal (Incl. Tax):</span>
                  <span className="step-value">₹{invoiceBreakdown.subtotal.toFixed(2)}</span>
                </div>

                <div className="calculation-step discount-step">
                  <span className="step-label">Total Item Discount:</span>
                  <span className="step-value">-₹{invoiceBreakdown.itemDiscount.toFixed(2)}</span>
                </div>

                <div className="calculation-step amount-before-tax">
                  <span className="step-label">Amount Before Tax:</span>
                  <span className="step-value">₹{invoiceBreakdown.amountBeforeTax.toFixed(2)}</span>
                </div>

                {/* Add Promo Discount Section */}
                {invoice.appliedPromoCode && (
                  <>
                    <div className="calculation-step promo-step">
                      <span className="step-label">
                        Promo Discount ({invoice.appliedPromoCode.discount}%):
                      </span>
                      <span className="step-value">-₹{invoiceBreakdown.promoDiscount.toFixed(2)}</span>
                    </div>

                    <div className="calculation-step taxable-amount">
                      <span className="step-label">Taxable Amount After Promo:</span>
                      <span className="step-value">₹{invoiceBreakdown.taxableAmountAfterPromo.toFixed(2)}</span>
                    </div>
                  </>
                )}

                {/* Tax Calculation */}
                {!invoice.hasMixedTaxRates && invoice.taxPercentages && invoice.taxPercentages.length > 0 && (
                  <>
                    <div className="calculation-step tax-step">
                      <span className="step-label">CGST ({invoice.taxPercentages[0] / 2}%):</span>
                      <span className="step-value">+₹{invoice.cgst?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="calculation-step tax-step">
                      <span className="step-label">SGST ({invoice.taxPercentages[0] / 2}%):</span>
                      <span className="step-value">+₹{invoice.sgst?.toFixed(2) || '0.00'}</span>
                    </div>
                  </>
                )}

                {invoice.hasMixedTaxRates && (
                  <div className="calculation-step tax-step">
                    <span className="step-label">Total GST:</span>
                    <span className="step-value">+₹{invoiceBreakdown.tax.toFixed(2)}</span>
                  </div>
                )}

                <div className="calculation-step total-row">
                  <span className="step-label">Grand Total:</span>
                  <span className="step-value total-amount">
                    ₹{invoiceBreakdown.grandTotal.toFixed(2)}
                  </span>
                </div>
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


  // Bulk Import Modal Component
  const BulkImportModal = ({ onClose, onImport, isLoading }) => {
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileSelect = (selectedFile) => {
      if (selectedFile && !isLoading) {
        const validTypes = [
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/csv'
        ];

        if (!validTypes.includes(selectedFile.type)) {
          toast.error("Please select a valid Excel file (.xlsx, .xls, .csv)");
          return;
        }
        setFile(selectedFile);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      if (!isLoading) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      setIsDragging(false);
    };

    const handleDrop = (e) => {
      e.preventDefault();
      if (!isLoading) {
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        handleFileSelect(droppedFile);
      }
    };

    const handleImport = () => {
      if (!file || isLoading) return;
      onImport(file);
    };

    return (
      <div className="modal-overlay" onClick={!isLoading ? onClose : undefined}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              {isLoading ? "Importing Invoices..." : "Bulk Import Invoices"}
            </div>
            {!isLoading && (
              <button className="modal-close" onClick={onClose}>&times;</button>
            )}
          </div>

          <div className="modal-body">
            {isLoading ? (
              <div className="import-loading">
                <div className="loading-spinner large"></div>
                <p>Importing invoices, please wait...</p>
                <div className="loading-progress">
                  <div className="progress-bar">
                    <div className="progress-fill"></div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="import-instructions">
                  <h4>File Requirements:</h4>
                  <ul>
                    <li>File format: Excel (.xlsx, .xls) or CSV</li>
                    <li>Must contain the exported invoice data with original structure</li>
                    <li>Multiple items in same invoice will be grouped automatically</li>
                    <li>Invoice numbers will be preserved as in the file</li>
                    <li>All data will be imported as-is without validation</li>
                  </ul>
                </div>

                <div
                  className={`file-drop-zone ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''} ${isLoading ? 'disabled' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !isLoading && fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => handleFileSelect(e.target.files[0])}
                    disabled={isLoading}
                  />

                  {file ? (
                    <div className="file-selected">
                      <FaFileExcel className="file-icon" />
                      <div className="file-info">
                        <div className="file-name">{file.name}</div>
                        <div className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                      </div>
                      {!isLoading && (
                        <button
                          className="remove-file"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                          }}
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="file-placeholder">
                      <FaFileExcel className="upload-icon" />
                      <p>Drop Excel file here or click to browse</p>
                      <small>Supports .xlsx, .xls, .csv files</small>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            {!isLoading && (
              <button className="cancel-btn" onClick={onClose}>
                Cancel
              </button>
            )}
            <button
              className={`import-btn ${isLoading ? 'loading' : ''}`}
              onClick={handleImport}
              disabled={!file || isLoading}
            >
              {isLoading ? (
                <>
                  <div className="loading-spinner small"></div>
                  Importing...
                </>
              ) : (
                <>
                  <FaFileExcel /> Import Invoices
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const invoiceTotals = calculateInvoiceTotals();

  return (
    <Navbar>
      {/* <ToastContainer position="top-center" autoClose={3000} />  */}

      <ToastContainer
        position="top-center"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover

      />
      <div className="main">
        <div className="page-header">
          {/* <h2>Tax Invoices</h2>  */}
          <div className="right-section">

            <div className="category-filter">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>


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

              {/* <button
                className="bulk-import-btn"
                onClick={() => setShowBulkImport(true)}
              >
                <FaFileExcel /> Bulk Import
              </button> */}


              <button className="export-all-btn" onClick={handleExportExcel}>
                <FaFileExcel /> Export All
              </button>
              <button className="add-btn" onClick={() => setShowForm(!showForm)}>
                <FaPlus /> {showForm ? "Close" : "Create"}
              </button>
            </div>
          </div>
        </div>

        {showForm && (
          <div className="form-container premium">
            <h2>Create Tax Invoice</h2>
            <Formik
              initialValues={{ paymentType: "cash" }}
              validationSchema={Yup.object().shape({
                paymentType: Yup.string().required("Payment type is required")
              })}
              onSubmit={handleSubmit}
            >
              {({ values, setFieldValue }) => (
                <Form>
                  <h3 className="section-heading">Invoice Date</h3>
                  <div className="form-group-row">
                    <div className="field-wrapper" style={{ flex: '0 0 33%', maxWidth: '300px' }}>
                      <label>Date *</label>
                      <input
                        type="date"
                        value={newCustomer.date}
                        onChange={(e) => setNewCustomer({ ...newCustomer, date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <h3 className="section-heading">Item Details</h3>
                  <div className="form-group-row">
                    <div className="field-wrapper">
                      <label>Search Products</label>
                      <input
                        type="text"
                        placeholder="Search by name, HSN Code, barcode or price..."
                        value={itemSearchTerm}
                        onChange={(e) => setItemSearchTerm(e.target.value)}
                      />
                      {isLoadingProducts && (
                        <div className="search-dropdown">
                          <div className="dropdown-item">Loading products...</div>
                        </div>
                      )}
                      {/* In the product search section */}


                      {itemSearchTerm && !isLoadingProducts && filteredProducts.length > 0 && (
                        <div className="search-dropdown">
                          {filteredProducts.map(product => {
                            const availableBatches = getAvailableBatches(product.productId);
                            const totalAvailable = availableBatches.reduce((sum, batch) => sum + batch.quantity, 0);

                            // Check for expired batches
                            const inventoryItem = inventory.find(item => item.productId === product.productId);
                            const hasExpiredBatches = inventoryItem && inventoryItem.batches.some(batch => {
                              const isExpired = new Date(batch.expiryDate) < new Date();
                              return batch.quantity > 0 && isExpired;
                            });

                            return (
                              <div
                                key={product.productId}
                                className={`dropdown-item ${totalAvailable === 0 ? 'out-of-stock' : ''}`}
                                onClick={() => {
                                  if (totalAvailable > 0) {
                                    handleProductSelect(product);
                                  }
                                }}
                              >
                                <div>
                                  {product.productName}
                                  {totalAvailable === 0 && hasExpiredBatches && (
                                    <span className="expired-badge">Expired Batches</span>
                                  )}
                                  {totalAvailable === 0 && !hasExpiredBatches && (
                                    <span className="stock-badge">Out of Stock</span>
                                  )}
                                  {totalAvailable > 0 && (
                                    <span className="stock-badge">In Stock: {totalAvailable}</span>
                                  )}
                                </div>
                                <div>
                                  HSN Code: {product.hsnCode || "N/A"} |
                                  Price: ₹{product.price || 0} |
                                  Tax: {product.taxSlab || 18}% |
                                  Category: {product.category}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {showBatchDropdown && (
                    <div className="batch-dropdown-overlay">
                      <div className="batch-dropdown" ref={batchDropdownRef}>
                        <h4>Select Batch</h4>
                        {getAvailableBatches(showBatchDropdown).map(batch => (
                          <div
                            key={batch.batchNumber}
                            className="batch-option"
                            onClick={() => handleBatchSelect(batch)}
                          >
                            <div className="batch-info">
                              <strong>Batch: {batch.batchNumber}</strong>
                              <span>Qty: {batch.quantity}</span>
                            </div>
                            <div className="batch-details">
                              Expiry: {new Date(batch.expiryDate).toLocaleDateString()}
                            </div>
                          </div>
                        ))}

                        {/* Show expired batches as disabled */}
                        {(() => {
                          const inventoryItem = inventory.find(item => item.productId === showBatchDropdown);
                          const expiredBatches = inventoryItem ? inventoryItem.batches.filter(batch => {
                            const isExpired = new Date(batch.expiryDate) < new Date();
                            return batch.quantity > 0 && isExpired;
                          }) : [];

                          return expiredBatches.length > 0 ? (
                            <div className="expired-batches-section">
                              <h5 style={{ color: '#ff6b6b', margin: '10px 0 5px 0' }}>Expired Batches</h5>
                              {expiredBatches.map(batch => (
                                <div
                                  key={batch.batchNumber}
                                  className="batch-option expired"
                                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                                  onClick={() => toast.error("This batch has expired and cannot be selected")}
                                >
                                  <div className="batch-info">
                                    <strong>Batch: {batch.batchNumber}</strong>
                                    <span>Qty: {batch.quantity}</span>
                                  </div>
                                  <div className="batch-details" style={{ color: '#ff6b6b' }}>
                                    EXPIRED: {new Date(batch.expiryDate).toLocaleDateString()}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null;
                        })()}

                        <button
                          className="cancel-batch-select"
                          onClick={() => setShowBatchDropdown(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedItems.length > 0 && (
                    <div>
                      <div className="items-table-container">
                        <table className="items-table">
                          <thead>
                            <tr>
                              <th width="5%">Sr No</th>
                              <th width="15%">Batch No</th>
                              <th width="20%">Product Name</th>
                              <th width="10%">Item Code</th>
                              <th width="8%">Qty</th>
                              <th width="12%">Price</th>
                              <th width="10%">Discount %</th>
                              <th width="15%">Total</th>
                              <th width="5%"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedItems.slice().reverse().map((item, index) => {
                              const availableQty = getAvailableQuantity(item.productId, item.batchNumber);
                              const actualIndex = selectedItems.length - index - 1;

                              return (
                                <tr key={`${item.productId}-${item.batchNumber}`}>
                                  <td>{selectedItems.length - index}</td>
                                  <td>
                                    <span className="batch-tag">{item.batchNumber}</span>
                                    <br />
                                    <small>Exp: {new Date(item.expiryDate).toLocaleDateString()}</small>
                                  </td>
                                  <td>
                                    {item.name}
                                    <br />
                                    <small className="category-tag">{item.category}</small>
                                  </td>
                                  <td>{item.hsn || "N/A"}</td>
                                  <td>
                                    <input
                                      type="number"
                                      min="1"
                                      max={availableQty}
                                      required
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const newQty = parseInt(e.target.value) || 0;
                                        if (newQty > availableQty) {
                                          toast.error(`Only ${availableQty} items available`);
                                          return;
                                        }
                                        handleItemUpdate(actualIndex, 'quantity', newQty);
                                      }}
                                    />
                                    <div className="available-qty">Available: {availableQty}</div>
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={item.price || 0}
                                      onChange={(e) => handleItemUpdate(actualIndex, 'price', parseFloat(e.target.value) || 0)}
                                      style={{ width: "80px" }}
                                    />
                                  </td>
                                  <td>{item.discount || 0}%</td>
                                  <td>
                                    ₹{(
                                      (item.price || 0) * item.quantity -
                                      ((item.price || 0) * item.quantity * (item.discount || 0) / 100)
                                    ).toFixed(2)}
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="invoice-remove-btn"
                                      onClick={() => {
                                        setSelectedItems(selectedItems.filter((_, i) => i !== actualIndex));
                                      }}
                                    >
                                      <FaTrash />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                        <div style={{ width: '350px', background: '#f9f9f9', padding: '15px', borderRadius: '8px' }}>
                          <h4 style={{ marginTop: 0, borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Invoice Calculation</h4>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span>Subtotal (Incl. Tax):</span>
                            <span>₹{invoiceTotals.subtotal.toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span>Total Discount:</span>
                            <span>₹{invoiceTotals.discount.toFixed(2)}</span>
                          </div>

                          {/* Add this promo discount row */}
                          {appliedPromo && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#28a745' }}>
                              <span>Promo Discount ({appliedPromo.discount}%):</span>
                              <span>-₹{invoiceTotals.promoDiscount.toFixed(2)}</span>
                            </div>
                          )}

                          {/* Rest of the tax calculation remains same */}
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


                  {/* Add this section before the Remarks section */}
                  <h3 className="section-heading">Promo Code (Optional)</h3>
                  <div className="form-group-row">
                    <div className="field-wrapper" style={{ width: '100%' }}>
                      <div className="promo-code-container">
                        <div className="promo-input-group">
                          <input
                            type="text"
                            placeholder="Enter promo code"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                            disabled={!!appliedPromo || isValidatingPromo}
                            className={promoError ? 'error' : ''}
                          />
                          {!appliedPromo ? (
                            <button
                              type="button"
                              className="apply-promo-btn"
                              onClick={() => validatePromoCode(promoCode)}
                              disabled={!promoCode.trim() || isValidatingPromo}
                            >
                              {isValidatingPromo ? <FaSpinner className="spinner" /> : "Apply"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="remove-promo-btn"
                              onClick={removePromoCode}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        {promoError && <div className="promo-error">{promoError}</div>}
                        {appliedPromo && (
                          <div className="promo-success">
                            ✅ {appliedPromo.code} applied - {appliedPromo.discount}% discount
                            {appliedPromo.description && `: ${appliedPromo.description}`}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

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




                  <h3 className="section-heading">Remarks (Optional)</h3>
                  <div className="form-group-row">
                    <div className="field-wrapper" style={{ width: '100%' }}>
                      <textarea
                        placeholder="Enter any additional remarks or notes..."
                        value={newCustomer.remarks || ''}
                        onChange={(e) => setNewCustomer({ ...newCustomer, remarks: e.target.value })}
                        rows={3}
                        style={{ width: '100%', resize: 'vertical' }}
                      />
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
                  <tr
                    key={invoice.invoiceNumber}
                    onClick={(e) => {
                      if (e.target.closest('.export-pdf-btn')) {
                        return;
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
                          e.stopPropagation();
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

        {showBulkImport && (
          <BulkImportModal
            onClose={() => setShowBulkImport(false)}
            onImport={handleBulkImport}
            isLoading={isBulkImportLoading}
          />
        )}

        <div style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden" }}>
          {invoiceForPrint && <SalesPrint invoice={invoiceForPrint.invoice} />}
        </div>
      </div>
    </Navbar>
  );
};

export default Sales;