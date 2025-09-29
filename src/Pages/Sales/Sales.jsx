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

  // Inventory update function
  const updateInventoryQuantities = async (invoiceItems) => {
    try {
      for (const item of invoiceItems) {
        await axios.put(`${import.meta.env.VITE_API_URL}/inventory/update-batch-quantity`, {
          productId: item.productId,
          batchNumber: item.batchNumber,
          quantitySold: item.quantity
        });
      }
    } catch (error) {
      console.error("Error updating inventory:", error);
      throw new Error("Failed to update inventory quantities");
    }
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

  // Invoice calculations
  const calculateInvoiceTotals = () => {
    let subtotal = 0;
    let totalDiscountAmount = 0;
    let totalBaseValue = 0;
    let totalTaxAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    const taxPercentages = new Set();

    const itemsWithCalculations = selectedItems.map(item => {
      const quantity = item.quantity || 1;
      const taxRate = item.taxSlab || 18;
      const discountPercentage = item.discount || 0;

      console.log(`Product: ${item.productName || "Unnamed"}, Tax Slab: ${taxRate}%`);

      taxPercentages.add(taxRate);

      const itemTotalInclTax = item.price * quantity;
      const itemDiscountAmount = itemTotalInclTax * (discountPercentage / 100);
      const itemTotalAfterDiscount = itemTotalInclTax - itemDiscountAmount;
      const itemBaseValue = itemTotalAfterDiscount / (1 + taxRate / 100);
      const itemTaxAmount = itemTotalAfterDiscount - itemBaseValue;
      const itemCgstAmount = taxPercentages.size === 1 ? itemTaxAmount / 2 : 0;
      const itemSgstAmount = taxPercentages.size === 1 ? itemTaxAmount / 2 : 0;
      const itemTotalAmount = itemTotalAfterDiscount;

      subtotal += itemTotalInclTax;
      totalDiscountAmount += itemDiscountAmount;
      totalBaseValue += itemBaseValue;
      totalTaxAmount += itemTaxAmount;
      cgstAmount += itemCgstAmount;
      sgstAmount += itemSgstAmount;

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

    const hasMixedTaxRates = taxPercentages.size > 1;
    if (hasMixedTaxRates) {
      cgstAmount = 0;
      sgstAmount = 0;
    }

    const grandTotal = subtotal - totalDiscountAmount;

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
        tax: invoiceTotals.tax,
        cgst: invoiceTotals.cgst,
        sgst: invoiceTotals.sgst,
        hasMixedTaxRates: invoiceTotals.hasMixedTaxRates,
        taxPercentages: invoiceTotals.taxPercentages,
        total: invoiceTotals.grandTotal,
        remarks: newCustomer.remarks || ''
      };

      const savedInvoice = await saveInvoiceToDB(invoice);
      // await updateInventoryQuantities(selectedItems); 

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
  // Update the generatePDF function
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
  // Excel export
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
                        <th width="10%">HSN</th>
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
              <h3 className="section-title">Invoice Summary</h3>
              <div className="invoice-summary-grid">
                <div className="summary-row">
                  <span className="summary-label">Subtotal:</span>
                  <span className="summary-value">₹{invoice.subtotal?.toFixed(2) || '0.00'}</span>
                </div>

                <div className="summary-row">
                  <span className="summary-label">Total Discount:</span>
                  <span className="summary-value">₹{invoice.discount?.toFixed(2) || '0.00'}</span>
                </div>

                {!invoice.hasMixedTaxRates && invoice.taxPercentages && invoice.taxPercentages.length > 0 && (
                  <>
                    <div className="summary-row">
                      <span className="summary-label">CGST ({invoice.taxPercentages[0] / 2}%):</span>
                      <span className="summary-value">₹{invoice.cgst?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-label">SGST ({invoice.taxPercentages[0] / 2}%):</span>
                      <span className="summary-value">₹{invoice.sgst?.toFixed(2) || '0.00'}</span>
                    </div>
                  </>
                )}

                {invoice.hasMixedTaxRates && (
                  <div className="summary-row">
                    <span className="summary-label">Total GST:</span>
                    <span className="summary-value">₹{invoice.tax?.toFixed(2) || '0.00'}</span>
                  </div>
                )}

                <div className="summary-row total-row">
                  <span className="summary-label">Grand Total:</span>
                  <span className="summary-value total-amount">
                    ₹{invoice.total?.toFixed(2) || '0.00'}
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
          <h2>Tax Invoices</h2>
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
                        placeholder="Search by name, HSN, barcode or price..."
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
                                  HSN: {product.hsnCode || "N/A"} |
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
                              <th width="10%">HSN</th>
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

        <div style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden" }}>
          {invoiceForPrint && <SalesPrint invoice={invoiceForPrint.invoice} />}
        </div>
      </div>
    </Navbar>
  );
};

export default Sales;