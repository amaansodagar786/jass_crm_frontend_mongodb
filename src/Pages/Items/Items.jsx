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
  FaFileDownload
} from "react-icons/fa";
import html2pdf from "html2pdf.js";
import * as XLSX from "xlsx";
import "../Form/Form.scss";
import "./Items.scss";
import "react-toastify/dist/ReactToastify.css";
import { TAX_SLABS } from "../../Components/TaxSlab/Taxslab";

const Items = () => {
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);

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
    quantity: "",
    taxSlab: "",
    price: ""
  };

  const validationSchema = Yup.object({
    productName: Yup.string().required("Product Name is required"),
    barcode: Yup.string().required("Barcode is required"),
    quantity: Yup.number()
      .required("Quantity is required")
      .min(1, "Quantity must be greater than 0"),
    taxSlab: Yup.string().required("Tax Slab is required"),
    price: Yup.number()
      .required("Price is required")
      .min(0, "Price cannot be negative")
  });

  // Fetch items
  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/items/get-items`)
      .then((res) => {
        const sortedData = res.data.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt)
            : (a._id?.getTimestamp ? new Date(a._id.getTimestamp()) : new Date(0));
          const dateB = b.createdAt ? new Date(b.createdAt)
            : (b._id?.getTimestamp ? new Date(b._id.getTimestamp()) : new Date(0));
          return dateB - dateA;
        });
        setItems(sortedData);
      })
      .catch((err) => {
        console.error("Error fetching items:", err);
        toast.error("Failed to load items.");
      });
  }, []);

  // Filter items by productName, barcode
  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return items;
    return items.filter((item) =>
      item.productName?.toLowerCase().includes(debouncedSearch) ||
      item.barcode?.toLowerCase().includes(debouncedSearch)
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
    try {
      const payload = {
        ...values,
        taxSlab: Number(values.taxSlab),
        price: Number(values.price)
      };

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/items/create-item`,
        payload
      );

      setItems((prev) => [response.data, ...prev]);
      toast.success("Item submitted successfully!");
      resetForm();
      setShowForm(false);
    } catch (error) {
      if (error.response && error.response.data.field === "productName") {
        const errorMessage = "Item with this name already exists";
        setFieldError("productName", errorMessage);
        toast.error(errorMessage);
      } else {
        console.error("Error saving item:", error);
        toast.error(error.response?.data?.message || "Failed to submit item.");
      }
    }
  };

  const selectItem = (itemId) => {
    setSelectedItem(prev => prev === itemId ? null : itemId);
  };

  const exportSelectedAsPDF = () => {
    if (!selectedItem) {
      toast.warning("Please select an item to export");
      return;
    }

    const item = items.find(i => i.itemId === selectedItem);

    const content = `
    <div style="font-family: 'Arial', sans-serif; padding: 30px; background: #fff;">
      <h1 style="color: #3f3f91; text-align: center; margin-bottom: 20px; font-size: 24px;">
        Item Details
      </h1>

      <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
        <h2 style="color: #3f3f91; margin-bottom: 15px; font-size: 20px;">
         <strong>Product Name:</strong> ${item.productName}
        </h2>
        <hr style="border: none; border-top: 1px solid #eee; margin-bottom: 15px;" />

        <p style="margin: 10px 0; font-size: 14px;">
          <strong>Barcode:</strong> ${item.barcode}
        </p>
        <p style="margin: 10px 0; font-size: 14px;">
          <strong>Quantity:</strong> ${item.quantity}
        </p>
        <p style="margin: 10px 0; font-size: 14px;">
          <strong>Tax Slab:</strong> ${item.taxSlab}%
        </p>
        <p style="margin: 10px 0; font-size: 14px;">
          <strong>Price:</strong> $${item.price.toFixed(2)}
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
      toast.warning("No items to export");
      return;
    }

    const data = dataToExport.map(item => ({
      "Product Name": item.productName,
      "Barcode": item.barcode,
      "Quantity": item.quantity,
      "Tax Slab": `${item.taxSlab}%`,
      "Price": `$${item.price.toFixed(2)}`
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Items");

    // Use appropriate filename based on whether filtered or all
    const fileName = debouncedSearch ? "filtered_items.xlsx" : "all_items.xlsx";
    XLSX.writeFile(workbook, fileName);
  };

  const handleUpdateItem = async (updatedItem) => {
    try {
      // Remove problematic fields before sending
      const { itemId, _id, createdAt, updatedAt, ...itemData } = updatedItem;

      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/items/update-item/${updatedItem.itemId}`,
        itemData
      );

      setItems(prev =>
        prev.map(item =>
          item.itemId === updatedItem.itemId ? response.data : item
        )
      );
      toast.success("Item updated successfully!");
    } catch (error) {
      console.error("Error updating item:", error);
      toast.error(error.response?.data?.message || "Error updating item");
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/items/delete-item/${itemId}`
      );

      setItems(prev =>
        prev.filter(item => item.itemId !== itemId)
      );
      setSelectedItem(null);
      toast.success("Item deleted successfully!");
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error(error.response?.data?.message || "Error deleting item");
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        "Product Name": "Example Product",
        "Barcode": "1234567890123",
        "Quantity": "10",
        "Tax Slab": "18",
        "Price": "29.99"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Items Template");
    XLSX.writeFile(workbook, "items_template.xlsx");
  };

  const handleBulkUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Validate and process the data
      if (jsonData.length === 0) {
        toast.error("No data found in the file");
        return;
      }

      // Process each item
      const uploadPromises = jsonData.map(item => {
        const payload = {
          productName: item['Product Name'],
          barcode: item['Barcode'],
          quantity: Number(item['Quantity']),
          taxSlab: Number(item['Tax Slab']),
          price: Number(item['Price'])
        };

        return axios.post(
          `${import.meta.env.VITE_API_URL}/items/create-item`,
          payload
        ).catch(error => {
          console.error("Error uploading item:", error);
          return { error: true, message: error.response?.data?.message || "Error uploading item" };
        });
      });

      // Execute all uploads
      Promise.all(uploadPromises).then(results => {
        const successfulUploads = results.filter(result => !result.error);
        const failedUploads = results.filter(result => result.error);

        if (successfulUploads.length > 0) {
          toast.success(`Successfully uploaded ${successfulUploads.length} items`);
          // Refresh the items list
          axios.get(`${import.meta.env.VITE_API_URL}/items/get-items`)
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

        if (failedUploads.length > 0) {
          toast.error(`Failed to upload ${failedUploads.length} items`);
        }

        setShowBulkUpload(false);
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
      setEditedItem(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
      // Validate quantity
      if (!editedItem.quantity || editedItem.quantity <= 0) {
        toast.error("Quantity must be greater than 0");
        return;
      }

      // Validate price
      if (!editedItem.price || editedItem.price < 0) {
        toast.error("Price cannot be negative");
        return;
      }

      // Validate other required fields
      if (!editedItem.productName || !editedItem.barcode || !editedItem.taxSlab) {
        toast.error("All fields are required");
        return;
      }

      try {
        await onUpdate(editedItem);
        setIsEditing(false);
      } catch (error) {
        console.error("Error updating item:", error);
      }
    };

    if (!item) return null;

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              {isEditing ? "Edit Item" : `Item Details: ${item.productName}`}
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

              {/* Quantity */}
              <div className="detail-row">
                <span className="detail-label">Quantity:</span>
                {isEditing ? (
                  <input
                    type="number"
                    name="quantity"
                    value={editedItem.quantity || ''}
                    onChange={handleInputChange}
                    className="edit-input"
                    min="1"
                  />
                ) : (
                  <span className="detail-value">{item.quantity}</span>
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
                  <span className="detail-value">${item.price?.toFixed(2)}</span>
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
                    onDelete(item.itemId);
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

  const BulkUploadModal = ({ onClose, onUpload, onDownloadTemplate }) => {
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
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content bulk-upload-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">Bulk Upload Items</div>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="modal-body">
            <div className="upload-instructions">
              <h4>Instructions:</h4>
              <ul>
                <li>Download the template file to ensure proper formatting</li>
                <li>Your Excel file should include these columns: Product Name, Barcode, Quantity, Tax Slab, Price</li>
                <li>Ensure all required fields are filled</li>
                <li>Tax Slab should be a number (e.g., 5, 12, 18)</li>
                <li>Quantity and Price should be numeric values</li>
              </ul>
            </div>

            <div className="template-download">
              <button onClick={onDownloadTemplate}>
                <FaFileDownload /> Download Template
              </button>
            </div>

            <div 
              className={`file-dropzone ${isDragging ? 'active' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input').click()}
            >
              <FaUpload size={40} color="#7366ff" />
              <p>Drag & drop your Excel file here or <span className="browse-link">browse</span></p>
              <input 
                id="file-input"
                type="file" 
                accept=".xlsx, .xls"
                onChange={(e) => handleFileSelect(e.target.files[0])}
                style={{ display: 'none' }}
              />
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
          <h2>Item List</h2>
          <div className="right-section">
            <div className="search-container">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search Items..."
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
                <FaPlus /> {showForm ? "Close" : "Add Item"}
              </button>
            </div>
          </div>
        </div>

        {showForm && (
          <div className="form-container premium">
            <h2>Add Item</h2>
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
                    <label><FaBarcode /> Barcode *</label>
                    <Field name="barcode" type="text" />
                    <ErrorMessage name="barcode" component="div" className="error" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label><FaHashtag /> Quantity *</label>
                    <Field name="quantity" type="number" />
                    <ErrorMessage name="quantity" component="div" className="error" />
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

                <div className="form-row">
                  <div className="form-field">
                    <label><FaDollarSign /> Price *</label>
                    <Field name="price" type="number" step="0.01" />
                    <ErrorMessage name="price" component="div" className="error" />
                  </div>
                </div>

                <button type="submit">Submit</button>
              </Form>
            </Formik>
          </div>
        )}

        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Barcode</th>
                <th>Quantity</th>
                <th>Tax Slab</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item, index) => (
                <tr
                  key={item.itemId || index}
                  className={selectedItem === item.itemId ? 'selected' : ''}
                  onClick={() => selectItem(item.itemId)}
                >
                  <td>{item.productName}</td>
                  <td>{item.barcode}</td>
                  <td>{item.quantity}</td>
                  <td>{item.taxSlab}%</td>
                  <td>${item.price?.toFixed(2)}</td>
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
        </div>

        {selectedItem && (
          <ItemModal
            item={items.find(i => i.itemId === selectedItem)}
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
          />
        )}
      </div>
    </Navbar>
  );
};

export default Items;