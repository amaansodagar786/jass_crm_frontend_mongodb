import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast, ToastContainer } from "react-toastify";
import {
    FaBox, FaBarcode, FaHashtag, FaDollarSign,
    FaPercentage, FaFileExport, FaPlus, FaSearch,
    FaSave, FaEdit
} from "react-icons/fa";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import Navbar from "../../Components/Sidebar/Navbar";
import "../Form/Form.scss";
import "./DiscountProduct.scss";
import "react-toastify/dist/ReactToastify.css";

const DiscountProduct = () => {
    const [showForm, setShowForm] = useState(false);
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(9);
    const [isLoading, setIsLoading] = useState(true);
    const [editingDiscounts, setEditingDiscounts] = useState({});
    const navigate = useNavigate();

    const [isSaving, setIsSaving] = useState(false);
    const [isSavingAll, setIsSavingAll] = useState(false);
    const [originalDiscounts, setOriginalDiscounts] = useState({});

    const [showUnsavedAlert, setShowUnsavedAlert] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState(null);


    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Debounce logic
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim().toLowerCase());
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Fetch products
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setIsLoading(true);
                const token = localStorage.getItem('token');
                const response = await fetch(
                    `${import.meta.env.VITE_API_URL}/products/get-products`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    }
                );

                if (!response.ok) {
                    if (response.status === 401) {
                        navigate('/login');
                        return;
                    }
                    throw new Error('Failed to fetch products');
                }

                const data = await response.json();

                // Sort by creation date (newest first)
                const sortedData = data.sort((a, b) => {
                    const dateA = new Date(a.createdAt);
                    const dateB = new Date(b.createdAt);
                    return dateB - dateA;
                });

                setProducts(sortedData);

                // Initialize editing discounts
                // Inside the fetch products useEffect, update the initialization:
                const initialEditingState = {};
                const initialOriginalState = {};
                sortedData.forEach(product => {
                    initialEditingState[product.productId] = product.discount || 0;
                    initialOriginalState[product.productId] = product.discount || 0;
                });
                setEditingDiscounts(initialEditingState);
                setOriginalDiscounts(initialOriginalState);

                setIsLoading(false);
            } catch (err) {
                console.error("Error fetching products:", err);
                toast.error("Failed to fetch products");
                setIsLoading(false);
            }
        };
        fetchProducts();
    }, [navigate]);

    // Filtered products
    const filteredProducts = useMemo(() => {
        if (!debouncedSearch) return products;

        return products.filter((product) => {
            const searchLower = debouncedSearch.toLowerCase();
            return (
                product.productName?.toLowerCase().includes(searchLower) ||
                product.barcode?.toLowerCase().includes(searchLower) ||
                product.hsnCode?.toLowerCase().includes(searchLower) ||
                product.price?.toString().includes(searchLower)
            );
        });
    }, [debouncedSearch, products]);

    const paginatedProducts = useMemo(() => {
        // If searching, show all filtered results without pagination
        if (debouncedSearch) return filteredProducts;

        // Otherwise, apply pagination
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredProducts.slice(0, startIndex + itemsPerPage);
    }, [filteredProducts, currentPage, itemsPerPage, debouncedSearch]);

    // Check if there are more products to load
    const hasMoreProducts = useMemo(() => {
        return debouncedSearch ? false : currentPage * itemsPerPage < filteredProducts.length;
    }, [currentPage, itemsPerPage, filteredProducts.length, debouncedSearch]);

    const loadMoreProducts = () => {
        setCurrentPage(prev => prev + 1);
    };

    // Handle discount change
    const handleDiscountChange = (productId, value) => {
        // Validate discount value (0-100)
        const discountValue = Math.min(Math.max(parseFloat(value) || 0, 0), 100);

        setEditingDiscounts(prev => ({
            ...prev,
            [productId]: discountValue
        }));
    };

    // Save discount for a product
    const saveDiscount = async (productId) => {
        try {
            setIsSaving(true);
            const newDiscount = editingDiscounts[productId];
            const token = localStorage.getItem('token');

            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/products/update-discount/${productId}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ discount: newDiscount }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to update discount");
            }

            // Update local state
            setProducts(prev =>
                prev.map(product =>
                    product.productId === productId
                        ? { ...product, discount: newDiscount }
                        : product
                )
            );

            // Update original discounts
            setOriginalDiscounts(prev => ({
                ...prev,
                [productId]: newDiscount
            }));

            toast.success("Discount updated successfully!");
        } catch (error) {
            console.error("Error updating discount:", error);
            toast.error(error.message || "Error updating discount");

            // Revert to original value on error
            const originalDiscount = originalDiscounts[productId] || 0;
            setEditingDiscounts(prev => ({
                ...prev,
                [productId]: originalDiscount
            }));
        } finally {
            setIsSaving(false);
        }
    };

    const saveAllDiscounts = async () => {
        try {
            setIsSavingAll(true);
            const token = localStorage.getItem('token');

            // Find which discounts have been changed
            const changedDiscounts = [];

            Object.keys(editingDiscounts).forEach(productId => {
                const currentDiscount = editingDiscounts[productId];
                const originalDiscount = originalDiscounts[productId] || 0;

                if (currentDiscount !== originalDiscount) {
                    changedDiscounts.push({
                        productId,
                        discount: currentDiscount
                    });
                }
            });

            if (changedDiscounts.length === 0) {
                toast.info("No changes to save");
                return;
            }

            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/products/bulk-update-discounts`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ discounts: changedDiscounts }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to update discounts");
            }

            const result = await response.json();

            // Update local state with new discounts
            setProducts(prev =>
                prev.map(product => {
                    const updatedDiscount = changedDiscounts.find(
                        item => item.productId === product.productId
                    );
                    return updatedDiscount
                        ? { ...product, discount: updatedDiscount.discount }
                        : product;
                })
            );

            // Update original discounts to match current ones
            setOriginalDiscounts(prev => ({
                ...prev,
                ...changedDiscounts.reduce((acc, item) => {
                    acc[item.productId] = item.discount;
                    return acc;
                }, {})
            }));

            toast.success(`Successfully updated ${changedDiscounts.length} discounts!`);
        } catch (error) {
            console.error("Error saving all discounts:", error);
            toast.error(error.message || "Error saving discounts");
        } finally {
            setIsSavingAll(false);
        }
    };

    // Export all products as Excel
    const exportAllAsExcel = () => {
        const dataToExport = filteredProducts.length > 0 ? filteredProducts : products;

        if (dataToExport.length === 0) {
            toast.warning("No products to export");
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(
            dataToExport.map((product) => ({
                "Product Name": product.productName,
                "Barcode": product.barcode || 'N/A',
                "HSN Code": product.hsnCode || 'N/A',
                "Price": `₹${product.price?.toFixed(2) || '0.00'}`,
                "Tax Slab": `${product.taxSlab || 0}%`,
                "Discount": `${product.discount || 0}%`,
                "Created At": new Date(product.createdAt).toLocaleDateString()
            }))
        );

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

        const fileName = debouncedSearch ? "filtered_products.xlsx" : "all_products.xlsx";
        XLSX.writeFile(workbook, fileName);
    };

    // Handle form submission
    const handleSubmit = async (values) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/products/create`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(values),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Failed to add product");
            }

            const savedProduct = data.product;
            setProducts(prev => [savedProduct, ...prev]);

            // Initialize discount for new product
            setEditingDiscounts(prev => ({
                ...prev,
                [savedProduct.productId]: savedProduct.discount || 0
            }));

            toast.success("Product added successfully!");
            setShowForm(false);
        } catch (error) {
            console.error("Error adding product:", error);
            toast.error(error.message || "Error creating product");
        }
    };

    // Handle unsaved changes alert actions
    const handleUnsavedAlertAction = async (action) => {
        if (action === 'save') {
            await saveAllDiscounts();
            setShowUnsavedAlert(false);
            if (pendingNavigation) {
                navigate(pendingNavigation);
                setPendingNavigation(null);
            }
        } else if (action === 'cancel') {
            // Revert all changes
            setEditingDiscounts(originalDiscounts);
            setShowUnsavedAlert(false);
            setPendingNavigation(null);
        } else if (action === 'continue') {
            setShowUnsavedAlert(false);
            if (pendingNavigation) {
                navigate(pendingNavigation);
                setPendingNavigation(null);
            }
        }
    };


    // Check for unsaved discount changes
    const hasUnsavedChanges = useMemo(() => {
        return Object.keys(editingDiscounts).some(productId =>
            editingDiscounts[productId] !== originalDiscounts[productId]
        );
    }, [editingDiscounts, originalDiscounts]);


    // Unsaved Changes Alert Modal
    const UnsavedChangesAlert = () => {
        if (!showUnsavedAlert) return null;

        const changedCount = Object.keys(editingDiscounts).filter(
            productId => editingDiscounts[productId] !== originalDiscounts[productId]
        ).length;

        return (
            <div className="modal-overlay unsaved-alert-overlay">
                <div className="modal-content unsaved-alert">
                    <div className="modal-header">
                        <div className="modal-title">Unsaved Changes</div>
                    </div>
                    <div className="modal-body">
                        <p>You have {changedCount} unsaved discount change(s). What would you like to do?</p>
                    </div>
                    <div className="modal-footer">
                        <button
                            className="save-all-btn"
                            onClick={() => handleUnsavedAlertAction('save')}
                            disabled={isSavingAll}
                        >
                            {isSavingAll ? (
                                <>
                                    <div className="loading-spinner small"></div>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <FaSave />
                                    Save & Go
                                </>
                            )}
                        </button>
                        <button
                            className="cancel-changes-btn"
                            onClick={() => handleUnsavedAlertAction('cancel')}
                        >
                            Discard
                        </button>
                        <button
                            className="continue-editing-btn"
                            onClick={() => handleUnsavedAlertAction('continue')}
                        >
                            Go Without Saving
                        </button>
                    </div>
                </div>
            </div>
        );
    };


    // Navigation guard for unsaved changes
    const handleNavigation = useCallback((path) => {
        console.log('Navigation attempted to:', path);
        console.log('Has unsaved changes:', hasUnsavedChanges);

        if (hasUnsavedChanges) {
            console.log('Showing unsaved alert');
            setPendingNavigation(path);
            setShowUnsavedAlert(true);
        } else {
            console.log('Navigating directly');
            navigate(path);
        }
    }, [hasUnsavedChanges, navigate]);

    return (
        // In the return statement, update the Navbar component
        <Navbar onNavigation={handleNavigation}>
            <ToastContainer position="top-center" autoClose={3000} />
            <div className="main">
                <div className="page-header">
                    {/* <h2>Discount Product Management</h2>  */}
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
                            <button
                                className="save-all-btn"
                                onClick={saveAllDiscounts}
                                disabled={isSavingAll}
                            >
                                {isSavingAll ? (
                                    <div className="loading-spinner small"></div>
                                ) : (
                                    <FaSave />
                                )}
                                {isSavingAll ? "Saving..." : "Save All"}
                            </button>

                            <button className="export-all-btn" onClick={exportAllAsExcel}>
                                <FaFileExport /> Export All
                            </button>
                            {/* <button className="add-btn" onClick={() => setShowForm(!showForm)}>
                                <FaPlus /> {showForm ? "Close" : "Add Product"}
                            </button> */}
                        </div>
                    </div>
                </div>

                {showForm && (
                    <div className="form-container premium">
                        <h2>Add New Product</h2>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.target);
                            const values = Object.fromEntries(formData);
                            // Convert number fields to proper types
                            values.price = parseFloat(values.price);
                            values.taxSlab = values.taxSlab ? parseFloat(values.taxSlab) : 0;
                            values.discount = values.discount ? parseFloat(values.discount) : 0;
                            handleSubmit(values);
                        }}>
                            <div className="form-group">
                                <div className="field-half">
                                    <label><FaBox /> Product Name *</label>
                                    <input
                                        name="productName"
                                        type="text"
                                        required
                                        placeholder="Enter product name"
                                    />
                                </div>
                                <div className="field-half">
                                    <label><FaBarcode /> Barcode</label>
                                    <input
                                        name="barcode"
                                        type="text"
                                        placeholder="Enter barcode"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <div className="field-half">
                                    <label><FaHashtag /> HSN Code</label>
                                    <input
                                        name="hsnCode"
                                        type="text"
                                        placeholder="Enter HSN code"
                                    />
                                </div>
                                <div className="field-half">
                                    <label><FaDollarSign /> Price *</label>
                                    <input
                                        name="price"
                                        type="number"
                                        step="0.01"
                                        required
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <div className="field-half">
                                    <label>Tax Slab (%)</label>
                                    <input
                                        name="taxSlab"
                                        type="number"
                                        step="0.01"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="field-half">
                                    <label><FaPercentage /> Discount (%)</label>
                                    <input
                                        name="discount"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        placeholder="0"
                                        defaultValue={0}
                                    />
                                </div>
                            </div>

                            <button type="submit">Create Product</button>
                        </form>
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
                                        <th>Barcode</th>
                                        <th>HSN Code</th>
                                        <th>Price</th>
                                        <th>Discount (%)</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedProducts.map((product, index) => (
                                        <tr key={product.productId || index}>
                                            <td>{product.productName}</td>
                                            <td>{product.barcode || 'N/A'}</td>
                                            <td>{product.hsnCode || 'N/A'}</td>
                                            <td>₹{product.price?.toFixed(2) || '0.00'}</td>
                                            <td>
                                                <div className="discount-edit-container">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="0.01"
                                                        value={editingDiscounts[product.productId] || 0}
                                                        onChange={(e) => handleDiscountChange(product.productId, e.target.value)}
                                                        className="discount-input"
                                                        placeholder="0"
                                                    />
                                                    <span>%</span>
                                                </div>
                                            </td>
                                            <td>
                                                <button
                                                    className="save-discount-btn"
                                                    onClick={() => saveDiscount(product.productId)}
                                                    disabled={isSaving || editingDiscounts[product.productId] === originalDiscounts[product.productId]}
                                                    title="Save discount"
                                                >
                                                    {isSaving ? (
                                                        <div className="loading-spinner small"></div>
                                                    ) : (
                                                        <FaSave />
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {hasMoreProducts && (
                                <div className="load-more-container">
                                    <button className="load-more-btn" onClick={loadMoreProducts}>
                                        Load More Products
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>


                <UnsavedChangesAlert />
            </div>
        </Navbar>
    );
};

export default DiscountProduct;