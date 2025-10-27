import React, { useState, useEffect, useRef, useMemo } from "react";
import Navbar from "../../Components/Sidebar/Navbar";
import html2pdf from "html2pdf.js";
import { FaFileExport, FaSearch, FaFilter, FaChevronDown, FaChevronUp, FaPlus, FaUpload } from "react-icons/fa";
import "./Inventory.scss";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as XLSX from 'xlsx';

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

    // Add these to your existing state declarations
    const [uploadErrors, setUploadErrors] = useState([]);
    const [showErrorModal, setShowErrorModal] = useState(false);

    const [expandedBatchDisposals, setExpandedBatchDisposals] = useState(new Set());

    const [productPrice, setProductPrice] = useState("");

    // ✅ ADDED: User access control state
    const [userHasInventoryAccess, setUserHasInventoryAccess] = useState(true);

    useEffect(() => {
        window.scrollTo(0, 0);
        checkUserAccess(); // ✅ Check user access first
        fetchData();
        fetchProducts();
    }, []);

    // ✅ ADDED: Function to check user access
    const checkUserAccess = () => {
        try {
            const userData = localStorage.getItem('user');
            if (userData) {
                const user = JSON.parse(userData);
                const restrictedEmails = [
                    "marketing@sfpsons.com",
                    "test@gmail.com"
                    // Add more restricted emails here as needed
                    // "another@example.com",
                ];

                const hasAccess = !restrictedEmails.includes(user.email);
                setUserHasInventoryAccess(hasAccess);

                if (!hasAccess) {
                    console.log(`User ${user.email} has restricted access to inventory modifications`);
                }
            }
        } catch (error) {
            console.error("Error checking user access:", error);
            setUserHasInventoryAccess(true); // Default to true if there's an error
        }
    };

    // In your Inventory.js component
    useEffect(() => {
        const runAutoCleanup = async () => {
            try {
                // Check if cleanup was run today
                const lastCleanup = localStorage.getItem('lastAutoCleanup');
                const today = new Date().toDateString();

                if (lastCleanup !== today) {
                    const response = await axios.post(`${import.meta.env.VITE_API_URL}/inventory/run-cleanup`);

                    if (response.data.success && response.data.data) {
                        const results = response.data.data;

                        // Show notification if batches were cleaned up
                        if (results.zeroQuantity.count > 0 || results.expired.count > 0) {
                            toast.info(
                                `Auto-cleanup: ${results.zeroQuantity.count} empty batches and ${results.expired.count} expired batches removed`
                            );
                        }

                        localStorage.setItem('lastAutoCleanup', today);
                    }
                }
            } catch (error) {
                console.error("Auto-cleanup failed:", error);
                // Don't show error to user - fail silently
            }
        };

        runAutoCleanup();
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

    const toggleBatchDisposal = (batchNumber) => {
        setExpandedBatchDisposals(prev => {
            const newSet = new Set(prev);
            if (newSet.has(batchNumber)) {
                newSet.delete(batchNumber);
            } else {
                newSet.add(batchNumber);
            }
            return newSet;
        });
    };

    // Export Functions
    const exportToExcel = () => {
        try {
            // Data to export (basic inventory data)
            const exportData = filteredInventory.map(item => ({
                'Product Name': item.productName,
                'Category': item.category,
                'HSN Code': item.hsnCode || '-',
                'Price': `₹${item.price?.toFixed(2) || "0.00"}`,
                'Total Quantity': item.totalQuantity,
                'Status': item.status
            }));

            // Create worksheet
            const worksheet = XLSX.utils.json_to_sheet(exportData);

            // Create workbook
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `inventory_export_${timestamp}.xlsx`;

            // Download file
            XLSX.writeFile(workbook, filename);

            toast.success("Inventory exported successfully!");
        } catch (error) {
            console.error("Error exporting to Excel:", error);
            toast.error("Failed to export inventory");
        }
    };

    const exportWithBatches = () => {
        try {
            const exportData = [];

            filteredInventory.forEach(item => {
                // Add main product row
                exportData.push({
                    'Product Name': item.productName,
                    'Category': item.category,
                    'HSN Code': item.hsnCode || '-',
                    'Price': `₹${item.price?.toFixed(2) || "0.00"}`,
                    'Total Quantity': item.totalQuantity,
                    'Status': item.status,
                    'Batch Number': '-',
                    'Batch Quantity': '-',
                    'Current Quantity': '-',
                    'Manufacture Date': '-',
                    'Expiry Date': '-',
                    'Added On': '-',
                    'Total Disposed': '-'
                });

                // Add batch rows if available
                if (item.batches && item.batches.length > 0) {
                    item.batches.forEach(batch => {
                        exportData.push({
                            'Product Name': '',
                            'Category': '',
                            'HSN Code': '',
                            'Price': '',
                            'Total Quantity': '',
                            'Status': '',
                            'Batch Number': batch.batchNumber,
                            'Batch Quantity': batch.originalQuantity,
                            'Current Quantity': batch.currentQuantity,
                            'Manufacture Date': new Date(batch.manufactureDate).toLocaleDateString(),
                            'Expiry Date': new Date(batch.expiryDate).toLocaleDateString(),
                            'Added On': new Date(batch.addedAt).toLocaleDateString(),
                            'Total Disposed': batch.totalDisposed || 0
                        });
                    });
                }
            });

            // Create worksheet
            const worksheet = XLSX.utils.json_to_sheet(exportData);

            // Create workbook
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory with Batches');

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `inventory_with_batches_${timestamp}.xlsx`;

            // Download file
            XLSX.writeFile(workbook, filename);

            toast.success("Inventory with batches exported successfully!");
        } catch (error) {
            console.error("Error exporting with batches:", error);
            toast.error("Failed to export inventory with batches");
        }
    };

    // ✅ ADDED: Protected modal open functions
    const handleAddQtyClick = () => {
        if (!userHasInventoryAccess) {
            toast.error("You don't have permission to add quantity");
            return;
        }
        setShowAddQtyModal(true);
    };

    const handleBulkUploadClick = () => {
        if (!userHasInventoryAccess) {
            toast.error("You don't have permission to bulk upload");
            return;
        }
        setShowBulkUploadModal(true);
    };

    // Add Qty Modal Functions
    const addBatchRow = () => {
        if (!userHasInventoryAccess) return;
        setBatches([...batches, { batchNumber: "", quantity: "", expiryDate: "" }]);
    };

    const removeBatchRow = (index) => {
        if (!userHasInventoryAccess) return;
        if (batches.length > 1) {
            const newBatches = batches.filter((_, i) => i !== index);
            setBatches(newBatches);
        }
    };

    const updateBatch = (index, field, value) => {
        if (!userHasInventoryAccess) return;
        const newBatches = batches.map((batch, i) =>
            i === index ? { ...batch, [field]: value } : batch
        );
        setBatches(newBatches);
    };

    const handleAddQtySubmit = async (e) => {
        e.preventDefault();

        if (!userHasInventoryAccess) {
            toast.error("You don't have permission to perform this action");
            return;
        }

        if (!selectedProduct) {
            toast.error("Please select a product");
            return;
        }

        if (!productPrice) {
            toast.error("Please enter purchase price per unit");
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
                price: parseFloat(productPrice),
                batches: validBatches.map(batch => {
                    // Extract only YYYY-MM from the month input
                    // The input type="month" returns format like "2024-04"
                    const yearMonth = batch.manufactureDate.substring(0, 7); // Get YYYY-MM

                    return {
                        batchNumber: batch.batchNumber,
                        quantity: parseInt(batch.quantity),
                        manufactureDate: yearMonth // Send only YYYY-MM format
                    }
                })
            });

            // ✅ FIX: Check if operation was successful (even with some warnings)
            if (response.data.success) {
                // Check if there are any errors in the response
                if (response.data.errors && response.data.errors.length > 0) {
                    // Show warning but still consider it success
                    toast.warning(`Batches processed with some warnings: ${response.data.message}`);
                } else {
                    toast.success(response.data.message || "Batches processed successfully!");
                }

                setShowAddQtyModal(false);
                resetAddQtyForm();
                fetchData();
            } else {
                // ❌ Actual failure
                toast.error(response.data.message || "Failed to add batches");
            }
        } catch (error) {
            console.error("Error adding batches:", error);

            // ✅ IMPROVED: User-friendly error messages
            if (error.response?.data?.errors && error.response.data.errors.length > 0) {
                // Show specific batch errors
                const firstError = error.response.data.errors[0];

                if (firstError.message.includes("different manufacture date")) {
                    toast.error(`❌ Batch "${firstError.batchNumber}" has different manufacture date. Please use a different batch number.`);
                } else if (firstError.message.includes("Missing required fields")) {
                    toast.error(`❌ Batch "${firstError.batchNumber}" is missing required information. Please fill all fields.`);
                } else if (firstError.message.includes("Invalid manufacture date")) {
                    toast.error(`❌ Batch "${firstError.batchNumber}" has invalid date format. Use YYYY-MM format.`);
                } else {
                    // Generic but specific error
                    toast.error(`❌ ${firstError.message} (Batch: ${firstError.batchNumber})`);
                }
            } else if (error.response?.data?.message) {
                // Handle other backend messages
                if (error.response.data.message.includes("All batches failed")) {
                    toast.error("❌ All batches failed validation. Please check batch numbers and manufacture dates.");
                } else {
                    toast.error("❌ " + error.response.data.message);
                }
            } else {
                toast.error("❌ Failed to add batches: " + (error.message || "Unknown error"));
            }
        }
    };

    const resetAddQtyForm = () => {
        setSelectedProduct(null);
        setProductSearch("");
        setProductPrice(""); // Reset price
        setBatches([{ batchNumber: "", quantity: "", manufactureDate: "" }]);
    };

    // Bulk Upload Functions - UPDATED
    const handleBulkUpload = async (e) => {
        e.preventDefault();

        if (!userHasInventoryAccess) {
            toast.error("You don't have permission to perform this action");
            return;
        }

        if (!uploadFile) {
            toast.error("Please select a file");
            return;
        }

        const formData = new FormData();
        formData.append("file", uploadFile);

        setUploadLoading(true);
        setUploadErrors([]); // Reset errors

        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/inventory/bulk-upload-batches`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });

            if (response.data.success) {
                if (response.data.addedBatches > 0) {
                    toast.success(`Bulk upload successful! ${response.data.addedBatches} batches added.`);
                }

                // Check if there are errors to show
                if (response.data.errors && response.data.errors.length > 0) {
                    setUploadErrors(response.data.errors);
                    setShowErrorModal(true);

                    if (response.data.addedBatches === 0) {
                        toast.error("Upload completed with errors. No batches were added.");
                    } else {
                        toast.warning("Upload completed with some errors. Please check the error report.");
                    }
                } else {
                    toast.success("All batches uploaded successfully!");
                    setShowBulkUploadModal(false);
                    setUploadFile(null);
                }

                fetchData();
            }
        } catch (error) {
            console.error("Error in bulk upload:", error);

            // Handle structured errors from backend
            if (error.response?.data?.errors) {
                setUploadErrors(error.response.data.errors);
                setShowErrorModal(true);
                toast.error("Upload failed with errors. Please check the error report.");
            } else {
                toast.error(error.response?.data?.message || "Failed to upload file");
            }
        } finally {
            setUploadLoading(false);
        }
    };

    const downloadErrorReport = () => {
        try {
            const errorData = [
                ['Row', 'Product Name', 'Batch Number', 'Error Reason', 'Details']
            ];

            uploadErrors.forEach((error, index) => {
                errorData.push([
                    error.rowNumber || index + 1,
                    error.productName || 'N/A',
                    error.batchNumber || 'N/A',
                    error.message || error.reason || 'Unknown error',
                    error.details || ''
                ]);
            });

            // Create CSV content
            let csvContent = "data:text/csv;charset=utf-8,";
            errorData.forEach(row => {
                csvContent += row.map(field => `"${field}"`).join(",") + "\r\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `batch-upload-errors-${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.info("Error report downloaded successfully!");
        } catch (error) {
            console.error("Error downloading error report:", error);
            toast.error("Failed to download error report");
        }
    };

    const downloadTemplate = () => {
        try {
            const templateData = [
                ['Product Name', 'Batch Number', 'Quantity', 'Manufacture Date (YYYY-MM)', 'Price'],
                ['Example Product 1', 'BATCH-001', '50', '2024-01', '100.00'],
                ['Example Product 2', 'BATCH-002', '25', '2024-02', '150.00'],
                ['Example Product 3', 'BATCH-003', '100', '2024-03', '200.00']
            ];

            // Create worksheet
            const worksheet = XLSX.utils.aoa_to_sheet(templateData);

            // Create workbook
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

            // Generate and download file
            XLSX.writeFile(workbook, 'batch-upload-template.xlsx');

            toast.info("Template downloaded successfully!");
        } catch (error) {
            console.error("Error downloading template:", error);

            // Fallback to CSV
            const templateData = [
                ['Product Name', 'Batch Number', 'Quantity', 'Manufacture Date (YYYY-MM)', 'Price'],
                ['Example Product 1', 'BATCH-001', '50', '2024-01', '100.00'],
                ['Example Product 2', 'BATCH-002', '25', '2024-02', '150.00']
            ];

            let csvContent = "data:text/csv;charset=utf-8,";
            templateData.forEach(row => {
                csvContent += row.join(",") + "\r\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "batch-upload-template.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.info("CSV Template downloaded successfully!");
        }
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
                    <div className="right-section inventory-header-right">
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
                            {/* ✅ UPDATED: Conditionally render buttons with access control */}
                            {userHasInventoryAccess ? (
                                <>
                                    <button
                                        className="add-qty-btn"
                                        onClick={handleAddQtyClick}
                                    >
                                        <FaPlus /> Add Qty
                                    </button>
                                    <button
                                        className="bulk-upload-btn"
                                        onClick={handleBulkUploadClick}
                                    >
                                        <FaUpload /> Bulk Upload
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        className="add-qty-btn disabled-btn"
                                        disabled
                                        title="Inventory modifications restricted for your account"
                                    >
                                        <FaPlus /> Add Qty
                                    </button>
                                    <button
                                        className="bulk-upload-btn disabled-btn"
                                        disabled
                                        title="Inventory modifications restricted for your account"
                                    >
                                        <FaUpload /> Bulk Upload
                                    </button>
                                </>
                            )}

                            <button className="export-btn" onClick={exportToExcel}>
                                <FaFileExport /> Export
                            </button>
                            <button className="export-with-batches-btn" onClick={exportWithBatches}>
                                <FaFileExport /> Export with Batches
                            </button>
                        </div>
                    </div>
                </div>

                {/* Export Buttons Row */}
                <div className="export-buttons-row">
                    <div className="export-buttons-container">
                        {/* Export buttons remain accessible to all users */}
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
                                                                                    <th>Current Quantity</th>
                                                                                    <th>Total Disposed</th>
                                                                                    <th>Manufacture Date</th>
                                                                                    <th>Expiry Date</th>
                                                                                    <th>Added On</th>
                                                                                    <th>Disposal History</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {item.batches.map((batch, batchIndex) => (
                                                                                    <React.Fragment key={batchIndex}>
                                                                                        <tr className="batch-main-row">
                                                                                            <td className="batch-number-cell">
                                                                                                <strong>{batch.batchNumber}</strong>
                                                                                            </td>
                                                                                            <td className="quantity-cell">
                                                                                                <span className={`quantity-badge ${batch.currentQuantity === 0 ? 'zero' : ''}`}>
                                                                                                    {batch.currentQuantity}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="disposed-cell">
                                                                                                {batch.totalDisposed > 0 ? (
                                                                                                    <span className="disposed-badge">
                                                                                                        {batch.totalDisposed} units
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span className="no-disposal">-</span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td>{new Date(batch.manufactureDate).toLocaleDateString()}</td>
                                                                                            <td className={
                                                                                                new Date(batch.expiryDate) < new Date() ? 'expired-date' : ''
                                                                                            }>
                                                                                                {new Date(batch.expiryDate).toLocaleDateString()}
                                                                                            </td>
                                                                                            <td>{new Date(batch.addedAt).toLocaleDateString()}</td>
                                                                                            <td className="disposal-info-cell">
                                                                                                {batch.disposals && batch.disposals.length > 0 ? (
                                                                                                    <button
                                                                                                        className="view-disposal-btn"
                                                                                                        onClick={() => toggleBatchDisposal(batch.batchNumber)}
                                                                                                    >
                                                                                                        {expandedBatchDisposals.has(batch.batchNumber) ? 'Hide' : 'View'} Details
                                                                                                        ({batch.disposals.length})
                                                                                                    </button>
                                                                                                ) : (
                                                                                                    <span className="no-disposal-history">No disposals</span>
                                                                                                )}
                                                                                            </td>
                                                                                        </tr>

                                                                                        {/* Disposal Details Row */}
                                                                                        {batch.disposals && batch.disposals.length > 0 &&
                                                                                            expandedBatchDisposals.has(batch.batchNumber) && (
                                                                                                <tr className="disposal-details-row">
                                                                                                    <td colSpan="7">
                                                                                                        <div className="disposal-details-container">
                                                                                                            <h5>Disposal History for Batch {batch.batchNumber}</h5>
                                                                                                            <div className="disposal-table-container">
                                                                                                                <table className="disposal-details-table">
                                                                                                                    <thead>
                                                                                                                        <tr>
                                                                                                                            <th>Date</th>
                                                                                                                            <th>Type</th>
                                                                                                                            <th>Quantity</th>
                                                                                                                            <th>Reason</th>
                                                                                                                            <th>Disposal ID</th>
                                                                                                                        </tr>
                                                                                                                    </thead>
                                                                                                                    <tbody>
                                                                                                                        {batch.disposals.map((disposal, disposalIndex) => (
                                                                                                                            <tr key={disposalIndex} className={`disposal-row ${disposal.type}`}>
                                                                                                                                <td className="disposal-date">
                                                                                                                                    {new Date(disposal.disposalDate).toLocaleDateString()}
                                                                                                                                </td>
                                                                                                                                <td>
                                                                                                                                    <span className={`disposal-type-badge ${disposal.type}`}>
                                                                                                                                        {disposal.type === 'defective' ? 'Defective' : 'Expired'}
                                                                                                                                    </span>
                                                                                                                                </td>
                                                                                                                                <td className="disposal-quantity">
                                                                                                                                    <span className="quantity-removed">
                                                                                                                                        {disposal.quantity} units
                                                                                                                                    </span>
                                                                                                                                </td>
                                                                                                                                <td className="disposal-reason">
                                                                                                                                    {disposal.reason || 'Not specified'}
                                                                                                                                </td>
                                                                                                                                <td className="disposal-id">
                                                                                                                                    {disposal.disposalId}
                                                                                                                                </td>
                                                                                                                            </tr>
                                                                                                                        ))}
                                                                                                                    </tbody>
                                                                                                                </table>
                                                                                                            </div>
                                                                                                            <div className="disposal-summary">
                                                                                                                <div className="summary-item">
                                                                                                                    <strong>Original Quantity:</strong> {batch.originalQuantity} units
                                                                                                                </div>
                                                                                                                <div className="summary-item">
                                                                                                                    <strong>Total Disposed:</strong> {batch.totalDisposed} units
                                                                                                                </div>
                                                                                                                <div className="summary-item">
                                                                                                                    <strong>Current Quantity:</strong> {batch.currentQuantity} units
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </td>
                                                                                                </tr>
                                                                                            )}
                                                                                    </React.Fragment>
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

                                <div className="form-group">
                                    <label>Purchase Price per Unit (₹) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={productPrice}
                                        onChange={(e) => setProductPrice(e.target.value)}
                                        placeholder="Enter purchase price per unit"
                                        min="0.01"
                                        required
                                    />
                                    <small>This price will be recorded for this inventory addition</small>
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
                                                <label>Manufacture Date (Month & Year) *</label>
                                                <input
                                                    type="month"
                                                    value={batch.manufactureDate}
                                                    onChange={(e) => updateBatch(index, "manufactureDate", e.target.value)}
                                                    required
                                                />
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
                                    <small>Format: Product Name, Batch Number, Quantity, Manufacture Date (MONTH - YYYY), Price</small>
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

                {/* Error Report Modal */}
                {showErrorModal && (
                    <div className="modal-overlay">
                        <div className="modal-content error-report-modal">
                            <div className="modal-header">
                                <h3>Upload Error Report</h3>
                                <button onClick={() => setShowErrorModal(false)} className="close-btn">×</button>
                            </div>

                            <div className="error-report-content">
                                <div className="error-summary">
                                    <p><strong>{uploadErrors.length} errors found during upload:</strong></p>
                                </div>

                                <div className="errors-table-container">
                                    <table className="errors-table">
                                        <thead>
                                            <tr>
                                                <th>Row</th>
                                                <th>Product Name</th>
                                                <th>Batch Number</th>
                                                <th>Error Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {uploadErrors.map((error, index) => (
                                                <tr key={index} className="error-row">
                                                    <td className="error-row-number">#{error.rowNumber || index + 1}</td>
                                                    <td className="error-product">{error.productName || "N/A"}</td>
                                                    <td className="error-batch">{error.batchNumber || "N/A"}</td>
                                                    <td className="error-reason">
                                                        <span className="error-message">{error.message || error.reason}</span>
                                                        {error.details && (
                                                            <small className="error-details">{error.details}</small>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="error-actions">
                                    <button
                                        onClick={() => {
                                            // Download error report as CSV
                                            downloadErrorReport();
                                        }}
                                        className="download-error-btn"
                                    >
                                        📥 Download Error Report
                                    </button>
                                    <button
                                        onClick={() => setShowErrorModal(false)}
                                        className="close-error-btn"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Navbar>
    );
};

export default Inventory;