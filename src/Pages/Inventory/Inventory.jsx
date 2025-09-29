import React, { useState, useEffect, useRef, useMemo } from "react";
import Navbar from "../../Components/Sidebar/Navbar";
import html2pdf from "html2pdf.js";
import { FaFileExport, FaSearch, FaFilter, FaChevronDown, FaChevronUp, FaPlus, FaUpload } from "react-icons/fa";
import "./Inventory.scss";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Inventory = () => {
    const [inventory, setInventory] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedRows, setExpandedRows] = useState(new Set());

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [showLoader, setShowLoader] = useState(false);
    const loaderTimeoutRef = useRef(null);

    const [stockFilter, setStockFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(15);

    // Modal states
    const [showAddQtyModal, setShowAddQtyModal] = useState(false);
    const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);

    // Add Qty form states
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [productSearch, setProductSearch] = useState("");
    const [batches, setBatches] = useState([{ batchNumber: "", quantity: "", manufactureDate: "" }]);
    // Bulk upload states
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadLoading, setUploadLoading] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
        fetchData();
        fetchProducts();
    }, []);

    useEffect(() => {
        if (loaderTimeoutRef.current) clearTimeout(loaderTimeoutRef.current);

        if (searchTerm.trim()) {
            loaderTimeoutRef.current = setTimeout(() => {
                setShowLoader(true);
            }, 300);

            const searchTimeout = setTimeout(() => {
                if (loaderTimeoutRef.current) clearTimeout(loaderTimeoutRef.current);
                setDebouncedSearch(searchTerm.trim().toLowerCase());
                setCurrentPage(1);
                setShowLoader(false);
            }, 300);

            return () => {
                clearTimeout(searchTimeout);
                if (loaderTimeoutRef.current) clearTimeout(loaderTimeoutRef.current);
                setShowLoader(false);
            };
        } else {
            setDebouncedSearch("");
            setCurrentPage(1);
            setShowLoader(false);
        }
    }, [searchTerm]);

    const fetchData = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/inventory/get-inventory`);
            if (response.data.success) {
                setInventory(Array.isArray(response.data.data) ? response.data.data : []);
            } else {
                setError(response.data.message || "Failed to load inventory data");
            }
            setLoading(false);
        } catch (error) {
            console.error("Error fetching inventory:", error);
            setError("Failed to load inventory data");
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/products/get-products`);
            if (Array.isArray(response.data)) {
                setProducts(response.data);
            }
        } catch (error) {
            console.error("Error fetching products:", error);
        }
    };

    // Filter inventory
    const filteredInventory = useMemo(() => {
        let result = inventory;

        // Apply stock filter
        if (stockFilter === "low") {
            result = result.filter(item => item.status === "Low Stock");
        } else if (stockFilter === "out") {
            result = result.filter(item => item.status === "Out of Stock");
        }

        // Apply search filter
        if (debouncedSearch) {
            result = result.filter(item => {
                if (item.productName?.toLowerCase().includes(debouncedSearch)) return true;
                if (item.category?.toLowerCase().includes(debouncedSearch)) return true;
                if (item.hsnCode?.toLowerCase().includes(debouncedSearch)) return true;
                if (item.status?.toLowerCase().includes(debouncedSearch)) return true;
                return false;
            });
        }

        return result;
    }, [debouncedSearch, inventory, stockFilter]);

    // Paginated inventory
    const paginatedInventory = useMemo(() => {
        if (debouncedSearch) return filteredInventory;
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredInventory.slice(0, startIndex + itemsPerPage);
    }, [filteredInventory, currentPage, itemsPerPage, debouncedSearch]);

    const hasMoreInventory = useMemo(() => {
        return debouncedSearch ? false : currentPage * itemsPerPage < filteredInventory.length;
    }, [currentPage, itemsPerPage, filteredInventory.length, debouncedSearch]);

    const loadMoreInventory = () => {
        setCurrentPage(prev => prev + 1);
    };

    const toggleRow = (inventoryId) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(inventoryId)) {
                newSet.delete(inventoryId);
            } else {
                newSet.add(inventoryId);
            }
            return newSet;
        });
    };

    // Add Qty Modal Functions
    const addBatchRow = () => {
        setBatches([...batches, { batchNumber: "", quantity: "", expiryDate: "" }]);
    };

    const removeBatchRow = (index) => {
        if (batches.length > 1) {
            const newBatches = batches.filter((_, i) => i !== index);
            setBatches(newBatches);
        }
    };

    const updateBatch = (index, field, value) => {
        const newBatches = batches.map((batch, i) =>
            i === index ? { ...batch, [field]: value } : batch
        );
        setBatches(newBatches);
    };

    const handleAddQtySubmit = async (e) => {
        e.preventDefault();

        if (!selectedProduct) {
            toast.error("Please select a product");
            return;
        }

        // Validate batches
        const validBatches = batches.filter(batch =>
            batch.batchNumber && batch.quantity && batch.manufactureDate
        );

        if (validBatches.length === 0) {
            toast.error("Please add at least one valid batch");
            return;
        }

        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/inventory/add-batches`, {
                productId: selectedProduct.productId,
                batches: validBatches.map(batch => {
                    const manufactureDate = new Date(batch.manufactureDate);
                    const expiryDate = new Date(manufactureDate);
                    expiryDate.setMonth(expiryDate.getMonth() + 36); // Add 36 months

                    return {
                        batchNumber: batch.batchNumber,
                        quantity: parseInt(batch.quantity),
                        manufactureDate: manufactureDate,
                        expiryDate: expiryDate
                    }
                })
            });

            if (response.data.success) {
                toast.success("Batches added successfully!");
                setShowAddQtyModal(false);
                resetAddQtyForm();
                fetchData();
            }
        } catch (error) {
            console.error("Error adding batches:", error);
            toast.error("Error adding batches: " + (error.response?.data?.message || error.message));
        }
    };

    const resetAddQtyForm = () => {
        setSelectedProduct(null);
        setProductSearch("");
        setBatches([{ batchNumber: "", quantity: "", expiryDate: "" }]);
    };

    // Bulk Upload Functions
    // Bulk Upload Functions - UPDATED
    const handleBulkUpload = async (e) => {
        e.preventDefault();

        if (!uploadFile) {
            toast.error("Please select a file");
            return;
        }

        const formData = new FormData();
        formData.append("file", uploadFile);

        setUploadLoading(true);
        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/inventory/bulk-upload-batches`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });

            if (response.data.success) {
                if (response.data.addedBatches > 0) {
                    toast.success(`Bulk upload successful! ${response.data.addedBatches} batches added.`);
                } else {
                    toast.warning("No batches were added. Please check your file format.");
                }

                // Show detailed errors in console
                if (response.data.errors && response.data.errors.length > 0) {
                    console.error("Bulk upload errors:", response.data.errors);
                    if (response.data.errors.length <= 5) {
                        response.data.errors.forEach(error => toast.error(error));
                    } else {
                        toast.error(`${response.data.errors.length} errors occurred. Check console for details.`);
                    }
                }

                setShowBulkUploadModal(false);
                setUploadFile(null);
                fetchData();
            }
        } catch (error) {
            console.error("Error in bulk upload:", error);

            if (error.response?.data?.errors) {
                console.error("Detailed errors:", error.response.data.errors);
                toast.error("Upload failed with errors. Check console for details.");
            } else {
                toast.error(error.response?.data?.message || "Failed to upload file");
            }
        } finally {
            setUploadLoading(false);
        }
    };


    const downloadTemplate = () => {
        const templateData = [
            ['Product Name', 'Batch Number', 'Quantity', 'Manufacture Date'],
            ['Example Product 1', 'BATCH-001', '50', '2024-01-15'],
            ['Example Product 2', 'BATCH-002', '25', '2024-02-20']
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

        XLSX.writeFile(workbook, 'batch-upload-template.xlsx');
        toast.info("Template downloaded successfully!");
    };

    // Filter products for searchable dropdown
    const filteredProducts = useMemo(() => {
        if (!productSearch) return products;
        const filtered = products.filter(product =>
            product.productName.toLowerCase().includes(productSearch.toLowerCase()) ||
            product.productId.toLowerCase().includes(productSearch.toLowerCase())
        );

        // Remove selected product from dropdown if it's already selected
        if (selectedProduct) {
            return filtered.filter(product => product.productId !== selectedProduct.productId);
        }
        return filtered;
    }, [products, productSearch, selectedProduct]);

    // Update product selection to clear search
    const handleProductSelect = (product) => {
        setSelectedProduct(product);
        setProductSearch("");
    };

    const handleExport = () => {
        const element = document.createElement("div");
        element.style.fontFamily = "Arial, sans-serif";
        element.style.padding = "20px";

        const title = document.createElement("h2");
        title.textContent = "Inventory Report";
        title.style.textAlign = "center";
        title.style.color = "#3f3f91";
        title.style.marginBottom = "20px";
        element.appendChild(title);

        const table = document.createElement("table");
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";
        table.style.border = "1px solid #ddd";

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        headerRow.style.backgroundColor = "#f5f6fa";

        ["Product Name", "Category", "HSN Code", "Price", "Total Quantity", "Status"].forEach(headerText => {
            const th = document.createElement("th");
            th.textContent = headerText;
            th.style.padding = "10px";
            th.style.border = "1px solid #ddd";
            th.style.fontWeight = "bold";
            th.style.color = "#3f3f91";
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        filteredInventory.forEach(item => {
            const row = document.createElement("tr");
            [
                item.productName,
                item.category,
                item.hsnCode || "-",
                `₹${item.price?.toFixed(2) || "0.00"}`,
                item.totalQuantity,
                item.status
            ].forEach(cellText => {
                const td = document.createElement("td");
                td.textContent = cellText;
                td.style.padding = "8px";
                td.style.border = "1px solid #ddd";

                if (cellText === "Low Stock") {
                    td.style.color = "#d32f2f";
                    td.style.fontWeight = "500";
                } else if (cellText === "Out of Stock") {
                    td.style.color = "#f44336";
                } else if (cellText === "In Stock") {
                    td.style.color = "#388e3c";
                }

                row.appendChild(td);
            });
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        element.appendChild(table);

        const filterInfo = document.createElement("p");
        filterInfo.textContent = `Filters applied: ${stockFilter !== "all" ? `Stock: ${stockFilter === "low" ? "Low Stock" : "Out of Stock"}` : "All Stock"}${debouncedSearch ? `, Search: "${debouncedSearch}"` : ""}`;
        filterInfo.style.marginTop = "15px";
        filterInfo.style.fontSize = "12px";
        filterInfo.style.color = "#666";
        element.appendChild(filterInfo);

        const exportDate = document.createElement("p");
        exportDate.textContent = `Exported on: ${new Date().toLocaleString()}`;
        exportDate.style.marginTop = "5px";
        exportDate.style.fontSize = "12px";
        exportDate.style.color = "#666";
        element.appendChild(exportDate);

        html2pdf().from(element).set({
            margin: 10,
            filename: "Inventory_Report.pdf",
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
        }).save();
    };

    if (error) {
        return (
            <Navbar>
                <div className="inventory-page">
                    <div className="error-message">{error}</div>
                </div>
            </Navbar>
        );
    }

    return (
        <Navbar>


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

            <div className="inventory-page">
                <div className="page-header">
                    <h2>Inventory</h2>
                    <div className="right-section">
                        <div className="filter-container">
                            <div className="filter-with-icon">
                                <FaFilter className="filter-icon" />
                                <select
                                    value={stockFilter}
                                    onChange={(e) => setStockFilter(e.target.value)}
                                    className="stock-filter"
                                >
                                    <option value="all">All Stock</option>
                                    <option value="low">Low Stock</option>
                                    <option value="out">Out of Stock</option>
                                </select>
                            </div>
                        </div>

                        <div className="search-container">
                            <FaSearch className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search inventory..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="action-buttons-group">
                            <button
                                className="add-qty-btn"
                                onClick={() => setShowAddQtyModal(true)}
                            >
                                <FaPlus /> Add Qty
                            </button>
                            <button
                                className="bulk-upload-btn"
                                onClick={() => setShowBulkUploadModal(true)}
                            >
                                <FaUpload /> Bulk Upload
                            </button>
                            <button className="export-all-btn" onClick={handleExport}>
                                <FaFileExport /> Export
                            </button>
                        </div>
                    </div>
                </div>

                <div className="data-table" id="inventory-table">
                    {loading ? (
                        <div className="loading">Loading inventory...</div>
                    ) : inventory.length === 0 ? (
                        <div className="no-data">No inventory items found</div>
                    ) : (
                        <>
                            <table>
                                <thead>
                                    <tr>
                                        <th></th>
                                        <th>Product Name</th>
                                        <th>Category</th>
                                        <th>HSN Code</th>
                                        <th>Price</th>
                                        <th>Total Quantity</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {showLoader ? (
                                        <tr>
                                            <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                                                <div className="table-loader"></div>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedInventory.map((item, index) => (
                                            <React.Fragment key={item.inventoryId}>
                                                <tr
                                                    className={`clickable-row ${expandedRows.has(item.inventoryId) ? 'expanded' : ''}`}
                                                    onClick={() => toggleRow(item.inventoryId)}
                                                >
                                                    <td className="expand-icon">
                                                        {expandedRows.has(item.inventoryId) ? <FaChevronUp /> : <FaChevronDown />}
                                                    </td>
                                                    <td>{item.productName}</td>
                                                    <td>{item.category}</td>
                                                    <td>{item.hsnCode || "-"}</td>
                                                    <td>₹{item.price?.toFixed(2) || "0.00"}</td>
                                                    <td>{item.totalQuantity}</td>
                                                    <td className={
                                                        item.status === "Out of Stock" ? "out-of-stock" :
                                                            item.status === "Low Stock" ? "low-stock" : "in-stock"
                                                    }>
                                                        {item.status}
                                                    </td>
                                                </tr>
                                                {expandedRows.has(item.inventoryId) && (
                                                    <tr className="batch-details-row">
                                                        <td colSpan="7">
                                                            <div className="batch-container">
                                                                <h4>Batch Details</h4>
                                                                {item.batches && item.batches.length > 0 ? (
                                                                    <div className="batch-table-container">
                                                                        <table className="batch-table">
                                                                            <thead>
                                                                                <tr>
                                                                                    <th>Batch Number</th>
                                                                                    <th>Quantity</th>
                                                                                    <th>Manufacture Date</th>
                                                                                    <th>Expiry Date</th>
                                                                                    <th>Added On</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {item.batches.map((batch, batchIndex) => (
                                                                                    <tr key={batchIndex}>
                                                                                        <td>{batch.batchNumber}</td>
                                                                                        <td>{batch.quantity}</td>
                                                                                        <td>{new Date(batch.manufactureDate).toLocaleDateString()}</td>
                                                                                        <td>{new Date(batch.expiryDate).toLocaleDateString()}</td>
                                                                                        <td>{new Date(batch.addedAt).toLocaleDateString()}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                ) : (
                                                                    <div className="no-batches">No batches available for this product</div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {hasMoreInventory && (
                                <div className="load-more-container">
                                    <button onClick={loadMoreInventory} className="load-more-btn">
                                        Load More
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Add Qty Modal */}
                {showAddQtyModal && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h3>Add Quantity to Product</h3>
                                <button onClick={() => { setShowAddQtyModal(false); resetAddQtyForm(); }} className="close-btn">×</button>
                            </div>

                            <form onSubmit={handleAddQtySubmit}>
                                <div className="form-group">
                                    <label>Search Product *</label>
                                    <div className="searchable-dropdown">
                                        <input
                                            type="text"
                                            placeholder="Type product name or ID..."
                                            value={productSearch}
                                            onChange={(e) => setProductSearch(e.target.value)}
                                            onFocus={() => setProductSearch("")}
                                        />
                                        {productSearch && (
                                            <div className="dropdown-options">
                                                {filteredProducts.map(product => (
                                                    <div
                                                        key={product.productId}
                                                        className="dropdown-option"
                                                        onClick={() => {
                                                            handleProductSelect(product);
                                                        }}
                                                    >
                                                        {product.productName} ({product.productId})
                                                    </div>
                                                ))}
                                                {filteredProducts.length === 0 && (
                                                    <div className="dropdown-option no-results">
                                                        No products found
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {selectedProduct && (
                                        <div className="product-info">
                                            <p><strong>Product:</strong> {selectedProduct.productName}</p>
                                            <p><strong>Category:</strong> {selectedProduct.category}</p>
                                            <p><strong>HSN:</strong> {selectedProduct.hsnCode || "-"}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="batches-section">
                                    <div className="section-header">
                                        <label>Batch Details *</label>
                                        <button type="button" onClick={addBatchRow} className="add-batch-btn">
                                            <FaPlus /> Add Batch
                                        </button>
                                    </div>

                                    {batches.map((batch, index) => (
                                        <div key={index} className="batch-row">
                                            <div className="form-group">
                                                <label>Batch Number</label>
                                                <input
                                                    type="text"
                                                    value={batch.batchNumber}
                                                    onChange={(e) => updateBatch(index, "batchNumber", e.target.value)}
                                                    placeholder="e.g., BATCH-001"
                                                    required
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Quantity</label>
                                                <input
                                                    type="number"
                                                    value={batch.quantity}
                                                    onChange={(e) => updateBatch(index, "quantity", e.target.value)}
                                                    placeholder="Enter quantity"
                                                    min="1"
                                                    required
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Manufacture Date *</label>
                                                <input
                                                    type="date"
                                                    value={batch.manufactureDate}
                                                    onChange={(e) => updateBatch(index, "manufactureDate", e.target.value)}
                                                    required
                                                />
                                                <small>Expiry will be automatically calculated (36 months from manufacture)</small>
                                            </div>
                                            {batches.length > 1 && (
                                                <button type="button" onClick={() => removeBatchRow(index)} className="remove-batch-btn">
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="modal-actions">
                                    <button type="button" onClick={() => { setShowAddQtyModal(false); resetAddQtyForm(); }} className="cancel-btn">
                                        Cancel
                                    </button>
                                    <button type="submit" className="submit-btn">
                                        Save Batches
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Bulk Upload Modal */}
                {showBulkUploadModal && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h3>Bulk Upload Batches</h3>
                                <button onClick={() => setShowBulkUploadModal(false)} className="close-btn">×</button>
                            </div>

                            <form onSubmit={handleBulkUpload}>
                                <div className="form-group">
                                    <label>Upload Excel File *</label>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls, .csv"
                                        onChange={(e) => setUploadFile(e.target.files[0])}
                                        required
                                    />
                                    <small>Format: Product Name, Batch Number, Quantity, Expiry Date (YYYY-MM-DD)</small>
                                </div>

                                <div className="download-template">
                                    <button
                                        type="button"
                                        onClick={downloadTemplate}
                                        className="template-download-btn"
                                    >
                                        📥 Download Template File
                                    </button>
                                </div>

                                <div className="modal-actions">
                                    <button type="button" onClick={() => setShowBulkUploadModal(false)} className="cancel-btn">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={uploadLoading} className="submit-btn">
                                        {uploadLoading ? "Uploading..." : "Upload File"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </Navbar>
    );
};

export default Inventory;