import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import Navbar from "../../Components/Sidebar/Navbar";
import {
  FaCubes,
  FaBarcode,
  FaHashtag,
  FaDollarSign,
  FaPercent,
  FaPlus,
  FaFileExport,
  FaFileExcel,
  FaSearch,
  FaEdit,
  FaSave,
  FaTrash,
  FaUpload,
  FaFileDownload,
  FaRupeeSign
} from "react-icons/fa";
import html2pdf from "html2pdf.js";
import * as XLSX from "xlsx";
import "../Form/Form.scss";
import "./Items.scss";
import "react-toastify/dist/ReactToastify.css";
import { TAX_SLABS } from "../../Components/TaxSlab/Taxslab";

const CATEGORY_OPTIONS = [
  "Air Freshener",
  "Deodorant & Body Spray",
  "Eau de Perfume",
  "Perfume Oil",
  "Sanitizer",
  "Shampoo",
  "Talc"
];

const Items = () => {
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim().toLowerCase());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const initialValues = {
    productName: "",
    barcode: "",
    hsnCode: "",
    taxSlab: "",
    price: "",
    category: ""
  };

  const validationSchema = Yup.object({
    productName: Yup.string().required("Product Name is required"),
    barcode: Yup.string().required("Barcode is required"),
    hsnCode: Yup.string().required("HSN Code is required"),
    taxSlab: Yup.string().required("Tax Slab is required"),
    price: Yup.number()
      .required("Price is required")
      .min(0, "Price cannot be negative"),
    category: Yup.string().required("Category is required")
  });

  // Fetch items
  useEffect(() => {
    setIsLoading(true);
    axios.get(`${import.meta.env.VITE_API_URL}/products/get-products`)
      .then((res) => {
        const sortedData = res.data.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt)
            : (a._id?.getTimestamp ? new Date(a._id.getTimestamp()) : new Date(0));
          const dateB = b.createdAt ? new Date(b.createdAt)
            : (b._id?.getTimestamp ? new Date(b._id.getTimestamp()) : new Date(0));
          return dateB - dateA;
        });
        setItems(sortedData);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching items:", err);
        toast.error("Failed to load items.");
        setIsLoading(false);
      });
  }, []);

  // Filter items by productName, barcode
  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return items;
    return items.filter((item) =>
      item.productName?.toLowerCase().includes(debouncedSearch) ||
      item.hsnCode?.toLowerCase().includes(debouncedSearch) ||
      item.barcode?.toLowerCase().includes(debouncedSearch) ||
      item.category?.toLowerCase().includes(debouncedSearch) ||
      // Convert price to string for searching
      item.price?.toString().includes(debouncedSearch)
    );
  }, [debouncedSearch, items]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    // If searching, show all filtered results without pagination
    if (debouncedSearch) return filteredItems;

    // Otherwise, apply pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(0, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage, debouncedSearch]);

  // Check if there are more items to load
  const hasMoreItems = useMemo(() => {
    return debouncedSearch ? false : currentPage * itemsPerPage < filteredItems.length;
  }, [currentPage, itemsPerPage, filteredItems.length, debouncedSearch]);

  // Load more items
  const loadMoreItems = () => {
    setCurrentPage(prev => prev + 1);
  };

  const handleSubmit = async (values, { resetForm, setFieldError }) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...values,
        taxSlab: Number(values.taxSlab),
        price: Number(values.price),
        discount: 0 // Set discount to 0 by default
      };

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/products/create-product`,
        payload
      );

      setItems((prev) => [response.data, ...prev]);
      toast.success("Product submitted successfully!");
      resetForm();
      setShowForm(false);
    } catch (error) {
      if (error.response && error.response.data.field === "productName") {
        const errorMessage = "Product with this name already exists";
        setFieldError("productName", errorMessage);
        toast.error(errorMessage);
      } else if (error.response && error.response.data.field === "barcode") {
        const errorMessage = "Product with this barcode already exists";
        setFieldError("barcode", errorMessage);
        toast.error(errorMessage);
      } else {
        console.error("Error saving product:", error);
        toast.error(error.response?.data?.message || "Failed to submit product.");
      }
    }
    finally {
      setIsSubmitting(false); // End loading
    }
  };

  const selectItem = (productId) => {
    setSelectedItem(prev => prev === productId ? null : productId);
  };

  const exportSelectedAsPDF = () => {
    if (!selectedItem) {
      toast.warning("Please select a product to export");
      return;
    }

    const item = items.find(i => i.productId === selectedItem);

    const content = `
    <div style="font-family: 'Arial', sans-serif; padding: 30px; background: #fff;">
      <h1 style="color: #3f3f91; text-align: center; margin-bottom: 20px; font-size: 24px;">
        Product Details
      </h1>

      <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
        <h2 style="color: #3f3f91; margin-bottom: 15px; font-size: 20px;">
         <strong>Product Name:</strong> ${item.productName}
        </h2>
        <hr style="border: none; border-top: 1px solid #eee; margin-bottom: 15px;" />
        <p style="margin: 10px 0; font-size: 14px;">
          <strong>Category:</strong> ${item.category} 
        </p>

        <p style="margin: 10px 0; font-size: 14px;">
          <strong>Barcode:</strong> ${item.barcode}
        </p>
        <p style="margin: 10px 0; font-size: 14px;">
          <strong>HSN Code:</strong> ${item.hsnCode}
        </p>
        <p style="margin: 10px 0; font-size: 14px;">
          <strong>Tax Slab:</strong> ${item.taxSlab}%
        </p>
        <p style="margin: 10px 0; font-size: 14px;">
          <strong>Price:</strong> ₹${item.price.toFixed(2)}
        </p>
      </div>
    </div>
  `;

    const opt = {
      margin: 10,
      filename: `${item.productName}_details.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 3 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(content).set(opt).save();
  };

  const exportAllAsExcel = () => {
    // Use filteredItems instead of items when search is applied
    const dataToExport = filteredItems.length > 0 ? filteredItems : items;

    if (dataToExport.length === 0) {
      toast.warning("No products to export");
      return;
    }

    const data = dataToExport.map(item => ({
      "Product Name": item.productName,
      "Category": item.category,
      "Barcode": item.barcode,
      "HSN Code": item.hsnCode,
      "Tax Slab": `${item.taxSlab}%`,
      "Price": `₹${item.price.toFixed(2)}`
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

    // Use appropriate filename based on whether filtered or all
    const fileName = debouncedSearch ? "filtered_products.xlsx" : "all_products.xlsx";
    XLSX.writeFile(workbook, fileName);
  };

  const handleUpdateItem = async (updatedItem) => {
    try {
      // Remove problematic fields before sending
      const { productId, _id, createdAt, updatedAt, ...itemData } = updatedItem;

      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/products/update-product/${updatedItem.productId}`,
        itemData
      );

      setItems(prev =>
        prev.map(item =>
          item.productId === updatedItem.productId ? response.data : item
        )
      );
      toast.success("Product updated successfully!");
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error(error.response?.data?.message || "Error updating product");
    }
  };

  const handleDeleteItem = async (productId) => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/products/delete-product/${productId}`
      );

      setItems(prev =>
        prev.filter(item => item.productId !== productId)
      );
      setSelectedItem(null);
      toast.success("Product deleted successfully!");
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error(error.response?.data?.message || "Error deleting product");
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        "Product Name": "Example Product",
        "Barcode": "1234567890123",
        "HSN Code": "123456",
        "Tax Slab": "18",
        "Price": "29.99",
        "Category": "Electronics"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products Template");
    XLSX.writeFile(workbook, "products_template.xlsx");
  };

  const handleBulkUpload = (event) => {
    setIsBulkUploading(true);
    const file = event.target.files[0];
    if (!file) {
      setIsBulkUploading(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error("No data found in the file");
        setIsBulkUploading(false);
        return;
      }

      // Prepare data for bulk upload with category
      const productsData = jsonData.map(item => ({
        productName: item['Product Name']?.trim() || null,
        category: item['Category']?.trim()?.toLowerCase() || null,
        barcode: item['Barcode'] ? item['Barcode'].toString().trim() : '0000000000000',
        hsnCode: item['HSN Code']?.trim() || '00',
        taxSlab: item['Tax Slab'] ? Number(item['Tax Slab']) : 0,
        price: item['Price'] ? Number(item['Price']) : 0,
        discount: 0 // Set discount to 0 by default
      }));

      // Filter out items with no product name OR no category
      const validProducts = productsData.filter(product =>
        product.productName && product.category // BOTH ARE REQUIRED
      );

      if (validProducts.length === 0) {
        toast.error("No valid products found in the file (missing product names or categories)");
        setIsBulkUploading(false);
        return;
      }

      // Send bulk upload request
      axios.post(
        `${import.meta.env.VITE_API_URL}/products/bulk-upload-products`,
        validProducts
      )
        .then(response => {
          const { successful, failed } = response.data;

          if (successful.length > 0) {
            toast.success(`Successfully uploaded ${successful.length} products`);
            // Refresh the products list
            axios.get(`${import.meta.env.VITE_API_URL}/products/get-products`)
              .then((res) => {
                const sortedData = res.data.sort((a, b) => {
                  const dateA = a.createdAt ? new Date(a.createdAt)
                    : (a._id?.getTimestamp ? new Date(a._id.getTimestamp()) : new Date(0));
                  const dateB = b.createdAt ? new Date(b.createdAt)
                    : (b._id?.getTimestamp ? new Date(b._id.getTimestamp()) : new Date(0));
                  return dateB - dateA;
                });
                setItems(sortedData);
              });
          }

          if (failed.length > 0) {
            toast.error(`Failed to upload ${failed.length} products`);
            console.error("Failed uploads:", failed);
          }

          setShowBulkUpload(false);
        })
        .catch(error => {
          console.error("Error in bulk upload:", error);
          toast.error("Failed to process bulk upload");
          setShowBulkUpload(false);
        })
        .finally(() => {
          setIsBulkUploading(false);
        });
    };
    reader.readAsArrayBuffer(file);
  };

  const ItemModal = ({ item, onClose, onExport, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedItem, setEditedItem] = useState({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'auto';
      };
    }, []);

    useEffect(() => {
      if (item) {
        setEditedItem({ ...item });
      }
    }, [item]);

    const handleInputChange = (e) => {
      const { name, value } = e.target;

      // For numeric fields, convert to number
      if (name === 'taxSlab' || name === 'price') {
        setEditedItem(prev => ({ ...prev, [name]: Number(value) }));
      } else {
        setEditedItem(prev => ({ ...prev, [name]: value }));
      }
    };

    const handleSave = async () => {
      // Validate price
      if (!editedItem.price || editedItem.price < 0) {
        toast.error("Price cannot be negative");
        return;
      }

      // Validate other required fields
      if (!editedItem.productName || !editedItem.barcode || !editedItem.hsnCode || !editedItem.taxSlab) {
        toast.error("All fields are required");
        return;
      }

      try {
        await onUpdate(editedItem);
        setIsEditing(false);
      } catch (error) {
        console.error("Error updating product:", error);
      }
    };

    if (!item) return null;

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              {isEditing ? "Edit Product" : `Product Details: ${item.productName}`}
            </div>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="modal-body">
            <div className="wo-details-grid">
              {/* Product Name */}
              <div className="detail-row">
                <span className="detail-label">Product Name:</span>
                {isEditing ? (
                  <input
                    type="text"
                    name="productName"
                    value={editedItem.productName || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                  />
                ) : (
                  <span className="detail-value">{item.productName}</span>
                )}
              </div>

              {/* Category */}
              <div className="detail-row">
                <span className="detail-label">Category:</span>
                {isEditing ? (
                  <select
                    name="category"
                    value={editedItem.category || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                  >
                    <option value="">Select Category</option>
                    {CATEGORY_OPTIONS.map((category, index) => (
                      <option key={index} value={category.toLowerCase()}>
                        {category}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="detail-value">
                    {CATEGORY_OPTIONS.find(cat => cat.toLowerCase() === item.category) || item.category}
                  </span>
                )}
              </div>

              {/* Barcode */}
              <div className="detail-row">
                <span className="detail-label">Barcode:</span>
                {isEditing ? (
                  <input
                    type="text"
                    name="barcode"
                    value={editedItem.barcode || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                  />
                ) : (
                  <span className="detail-value">{item.barcode}</span>
                )}
              </div>

              {/* HSN Code */}
              <div className="detail-row">
                <span className="detail-label">HSN Code:</span>
                {isEditing ? (
                  <input
                    type="text"
                    name="hsnCode"
                    value={editedItem.hsnCode || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                  />
                ) : (
                  <span className="detail-value">{item.hsnCode}</span>
                )}
              </div>

              {/* Tax Slab */}
              <div className="detail-row">
                <span className="detail-label">Tax Slab:</span>
                {isEditing ? (
                  <select
                    name="taxSlab"
                    value={editedItem.taxSlab || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                  >
                    <option value="">Select Tax Slab</option>
                    {TAX_SLABS.map((slab, index) => (
                      <option key={index} value={slab.value}>
                        {slab.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="detail-value">{item.taxSlab}%</span>
                )}
              </div>

              {/* Price */}
              <div className="detail-row">
                <span className="detail-label">Price:</span>
                {isEditing ? (
                  <input
                    type="number"
                    name="price"
                    value={editedItem.price || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                    min="0"
                    step="0.01"
                  />
                ) : (
                  <span className="detail-value">₹{item.price?.toFixed(2)}</span>
                )}
              </div>

              {/* Created At */}
              <div className="detail-row">
                <span className="detail-label">Created At:</span>
                <span className="detail-value">
                  {new Date(item.createdAt || item._id?.getTimestamp()).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button className="export-btn" onClick={onExport}>
              <FaFileExport /> Export as PDF
            </button>
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
              <p>Are you sure you want to delete {item.productName}? This action cannot be undone.</p>
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
                    onDelete(item.productId);
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

  const BulkUploadModal = ({ onClose, onUpload, onDownloadTemplate, isUploading }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      setIsDragging(false);
    };

    const handleDrop = (e) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    };

    const handleFileSelect = (file) => {
      if (file && (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel')) {
        const event = { target: { files: [file] } };
        onUpload(event);
      } else {
        toast.error("Please select a valid Excel file (.xlsx)");
      }
    };

    return (
      <div className="modal-overlay" onClick={isUploading ? undefined : onClose}>
        <div className="modal-content bulk-upload-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">Bulk Upload Products</div>
            {!isUploading && (
              <button className="modal-close" onClick={onClose}>
                &times;
              </button>
            )}
          </div>

          <div className="modal-body">
            <div className="upload-instructions">
              <h4>Instructions:</h4>
              <ul>
                <li>Download the template file to ensure proper formatting</li>
                <li>Your Excel file should include these columns: Product Name, Category, Barcode, HSN Code, Tax Slab, Price</li>
                <li>Ensure all required fields are filled (Product Name and Category are required)</li>
                <li>Tax Slab should be a number (e.g., 5, 18)</li>
                <li>Price should be numeric values</li>
                <li>Category should be text (e.g., Electronics, Clothing)</li>
              </ul>
            </div>

            {!isUploading && (
              <div className="template-download">
                <button onClick={onDownloadTemplate}>
                  <FaFileDownload /> Download Template
                </button>
              </div>
            )}

            <div
              className={`file-dropzone ${isDragging ? 'active' : ''} ${isUploading ? 'uploading' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={isUploading ? undefined : handleDrop}
              onClick={isUploading ? undefined : () => document.getElementById('file-input').click()}
            >
              {isUploading ? (
                <>
                  <div className="loading-spinner large"></div>
                  <p>Processing your file, please wait...</p>
                </>
              ) : (
                <>
                  <FaUpload size={40} color="#7366ff" />
                  <p>Drag & drop your Excel file here or <span className="browse-link">browse</span></p>
                  <input
                    id="file-input"
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={(e) => onUpload(e)}
                    style={{ display: 'none' }}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Navbar>
      <ToastContainer position="top-center" autoClose={3000} />
      <div className="main">
        <div className="page-header">
          <h2>Product List</h2>
          <div className="right-section">
            <div className="search-container">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search Products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="action-buttons-group">
              <button className="export-all-btn" onClick={exportAllAsExcel}>
                <FaFileExcel /> Export All
              </button>
              <button className="bulk-upload-btn" onClick={() => setShowBulkUpload(true)}>
                <FaUpload /> Bulk Upload
              </button>
              <button className="add-btn" onClick={() => setShowForm(!showForm)}>
                <FaPlus /> {showForm ? "Close" : "Add Product"}
              </button>
            </div>
          </div>
        </div>

        {showForm && (
          <div className="form-container premium">
            <h2>Add Product</h2>
            <Formik
              initialValues={initialValues}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              <Form>
                <div className="form-row">
                  <div className="form-field">
                    <label><FaCubes /> Product Name *</label>
                    <Field name="productName" type="text" />
                    <ErrorMessage name="productName" component="div" className="error" />
                  </div>
                  <div className="form-field">
                    <label>Category *</label>
                    <Field as="select" name="category" className="select-field">
                      <option value="">Select Category</option>
                      {CATEGORY_OPTIONS.map((category, index) => (
                        <option key={index} value={category.toLowerCase()}>
                          {category}
                        </option>
                      ))}
                    </Field>
                    <ErrorMessage name="category" component="div" className="error" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label><FaBarcode /> Barcode *</label>
                    <Field name="barcode" type="text" />
                    <ErrorMessage name="barcode" component="div" className="error" />
                  </div>
                  <div className="form-field">
                    <label><FaHashtag /> HSN Code *</label>
                    <Field name="hsnCode" type="text" />
                    <ErrorMessage name="hsnCode" component="div" className="error" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label><FaRupeeSign /> Price *</label>
                    <Field name="price" type="number" step="0.01" />
                    <ErrorMessage name="price" component="div" className="error" />
                  </div>
                  <div className="form-field">
                    <label><FaPercent /> Tax Slab *</label>
                    <Field as="select" name="taxSlab" className="select-field">
                      <option value="">Select Tax Slab</option>
                      {TAX_SLABS.map((slab, index) => (
                        <option key={index} value={slab.value}>
                          {slab.label}
                        </option>
                      ))}
                    </Field>
                    <ErrorMessage name="taxSlab" component="div" className="error" />
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit"}
                  {isSubmitting && <span className="loading-spinner"></span>}
                </button>
              </Form>
            </Formik>
          </div>
        )}

        <div className="data-table">
          {isLoading ? (
            <div className="loading-container">
              <div className="loading-spinner large"></div>
              <p>Loading products...</p>
            </div>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Barcode</th>
                    <th>HSN Code</th>
                    <th>Tax Slab</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item, index) => (
                    <tr
                      key={item.productId || index}
                      className={selectedItem === item.productId ? 'selected' : ''}
                      onClick={() => selectItem(item.productId)}
                    >
                      <td>{item.productName}</td>
                      <td>{item.category}</td>
                      <td>{item.barcode}</td>
                      <td>{item.hsnCode}</td>
                      <td>{item.taxSlab}%</td>
                      <td>₹{item.price?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasMoreItems && (
                <div className="load-more-container">
                  <button className="load-more-btn" onClick={loadMoreItems}>
                    Load More
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {selectedItem && (
          <ItemModal
            item={items.find(i => i.productId === selectedItem)}
            onClose={() => setSelectedItem(null)}
            onExport={exportSelectedAsPDF}
            onUpdate={handleUpdateItem}
            onDelete={handleDeleteItem}
          />
        )}

        {showBulkUpload && (
          <BulkUploadModal
            onClose={() => setShowBulkUpload(false)}
            onUpload={handleBulkUpload}
            onDownloadTemplate={downloadTemplate}
            isUploading={isBulkUploading}
          />
        )}
      </div>
    </Navbar>
  );
};

export default Items;