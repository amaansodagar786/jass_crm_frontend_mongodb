import React, { useEffect, useState } from "react";
import Navbar from "../../Components/Sidebar/Navbar";
import {
  FiShoppingCart,
  FiTruck,
  FiPackage,
  FiDollarSign,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiPlusCircle,
  FiCalendar,
} from "react-icons/fi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
import "./Home.css";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const [salesData, setSalesData] = useState([]);
  const [purchaseData, setPurchaseData] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [bomData, setBomData] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [showOutOfStockModal, setShowOutOfStockModal] = useState(false);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [outOfStockItems, setOutOfStockItems] = useState([]);
  const [expiringItems, setExpiringItems] = useState([]);
  const [itemsToShow, setItemsToShow] = useState(6);

  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (showLowStockModal || showOutOfStockModal || showExpiryModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showLowStockModal, showOutOfStockModal, showExpiryModal]);

  const handleOrderItem = (item) => {
    localStorage.setItem('preSelectedItem', JSON.stringify({
      itemName: item.itemName,
      description: item.description || "",
      hsnCode: item.hsnCode || "",
      unit: item.unit || "",
      itemId: item.itemId || "",
      rate: item.rate || 0,
      minimumQty: item.minimumQty || 0
    }));

    navigate('/purchase-order');
  };

  // Function to calculate expiring items (within 3 months)
  const getExpiringItems = (inventoryData) => {
    const today = new Date();
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(today.getMonth() + 3);

    const expiringItems = [];

    inventoryData.forEach(item => {
      if (item.batches && Array.isArray(item.batches)) {
        item.batches.forEach(batch => {
          if (batch.expiryDate) {
            const expiryDate = new Date(batch.expiryDate);
            if (expiryDate <= threeMonthsFromNow && expiryDate >= today) {
              expiringItems.push({
                ...item,
                batchNumber: batch.batchNumber,
                expiryDate: batch.expiryDate,
                quantity: batch.quantity,
                daysUntilExpiry: Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))
              });
            }
          }
        });
      }
    });

    // Sort by closest expiry date
    return expiringItems.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  };

  const processChartData = (data, type) => {
    if (!Array.isArray(data)) {
      console.error(`Expected array for ${type} data, got:`, typeof data);
      return [];
    }

    const dateField = type === "sales" ? "invoiceDate" : "grnDate";
    const valueField = "total";

    const monthlyData = data.reduce((acc, item) => {
      if (!item[dateField]) {
        console.warn(`Missing date field in ${type} item:`, item);
        return acc;
      }

      const date = new Date(item[dateField]);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!acc[monthYear]) {
        acc[monthYear] = { date: monthYear, value: 0, count: 0 };
      }
      acc[monthYear].value += item[valueField] || 0;
      acc[monthYear].count += 1;
      return acc;
    }, {});

    return Object.values(monthlyData)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-6);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Starting data fetch...");

        // Only include URLs that exist and work
        const urls = [
          `${import.meta.env.VITE_API_URL}/invoices/get-invoices`,
          `${import.meta.env.VITE_API_URL}/inventory/get-inventory`,
          // Commented out until these routes are implemented
          // `${import.meta.env.VITE_API_URL}/grn/get-grns`,
          // `${import.meta.env.VITE_API_URL}/bom/get-boms`,
          // `${import.meta.env.VITE_API_URL}/workorder/get-workorders`,
          // `${import.meta.env.VITE_API_URL}/po/get-pos` 
        ];

        const responses = await Promise.all(
          urls.map(url =>
            fetch(url)
              .then(res => {
                if (!res.ok) {
                  throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
              })
              .catch(error => {
                console.warn(`Failed to fetch from ${url}:`, error.message);
                return { success: false, data: [] }; // Return empty data on error
              })
          )
        );

        // Extract data from responses - only for the URLs we actually called
        const [salesResponse, inventoryResponse] = responses;

        const sales = salesResponse.success ? salesResponse.data : [];
        const inventory = inventoryResponse.success ? inventoryResponse.data : [];

        console.log("Extracted data:", {
          sales: sales.length,
          inventory: inventory.length,
        });

        setSalesData(Array.isArray(sales) ? sales : []);
        setInventoryData(Array.isArray(inventory) ? inventory : []);
        
        // Set empty arrays for the commented out routes
        setPurchaseData([]);
        setBomData([]);
        setWorkOrders([]);
        setPurchaseOrders([]);

        // Calculate expiring items
        if (Array.isArray(inventory)) {
          const expiring = getExpiringItems(inventory);
          setExpiringItems(expiring);
        }

      } catch (error) {
        console.error("Error in fetchData:", error);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Find work orders without sales - temporarily disabled
  const pendingWorkOrders = []; // workOrders.filter(wo => {
    // return !salesData.some(sale => sale.workOrderNumber === wo.workOrderNumber);
  // });

  // Find POs without GRNs - temporarily disabled
  const pendingGRNs = []; // purchaseOrders.filter(po => {
    // return !purchaseData.some(grn => grn.poNumber === po.poNumber);
  // });

  // Inventory status
  const inventoryStatus = inventoryData.reduce(
    (acc, item) => {
      // Use totalQuantity instead of currentStock since that's what your inventory schema has
      const stock = item.totalQuantity || 0;
      const minQty = item.minimumQty || 0;
      
      if (stock <= 0) acc.outOfStock++;
      else if (stock <= minQty) acc.lowStock++;
      else acc.inStock++;
      return acc;
    },
    { inStock: 0, lowStock: 0, outOfStock: 0 }
  );

  useEffect(() => {
    const lowStock = inventoryData.filter(
      item => {
        const stock = item.totalQuantity || 0;
        const minQty = item.minimumQty || 0;
        return stock > 0 && stock <= minQty;
      }
    );
    setLowStockItems(lowStock);
  }, [inventoryData]);

  useEffect(() => {
    const outOfStock = inventoryData.filter(item => {
      const stock = item.totalQuantity || 0;
      return stock <= 0;
    });
    setOutOfStockItems(outOfStock);
  }, [inventoryData]);

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div>
      <Navbar>
        <div className="dashboard-container">
          {/* Inventory Alerts - Updated with Expiry Alert */}
          <div className="inventory-alerts">
            <h3>Inventory Alerts</h3>
            <div className="alert-grid">
              <div
                className="alert-section expiry-alert clickable-alert"
                onClick={() => setShowExpiryModal(true)}
              >
                <h4>
                  <FiCalendar className="icon-expiry" /> Expiring Soon
                </h4>
                <div className="alert-count">
                  {expiringItems.length} items expiring in 3 months
                </div>
              </div>

              <div
                className="alert-section low-stock-alert clickable-alert"
                onClick={() => setShowLowStockModal(true)}
              >
                <h4>
                  <FiAlertTriangle className="icon-warning" /> Low Stock
                </h4>
                <div className="alert-count">
                  {lowStockItems.length} items need attention
                </div>
              </div>

              <div
                className="alert-section out-of-stock-alert clickable-alert"
                onClick={() => setShowOutOfStockModal(true)}
              >
                <h4>
                  <FiAlertTriangle className="icon-danger" /> Out of Stock
                </h4>
                <div className="alert-count">
                  {outOfStockItems.length} items unavailable
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="metrics-grid">
            <div className="metric-card sales-metric">
              <FiDollarSign className="metric-icon" />
              <div>
                <h3>Total Sales</h3>
                <p>
                  ₹{salesData.reduce((sum, sale) => sum + (sale?.total || 0), 0).toLocaleString()}
                </p>
                <small>{salesData.length} invoices</small>
              </div>
            </div>

            <div className="metric-card purchases-metric">
              <FiShoppingCart className="metric-icon" />
              <div>
                <h3>Total Purchases</h3>
                <p>
                  ₹{purchaseData.reduce((sum, purchase) => sum + (purchase?.total || 0), 0).toLocaleString()}
                </p>
                <small>{purchaseData.length} GRNs</small>
              </div>
            </div>

            <div className="metric-card inventory-metric">
              <FiPackage className="metric-icon" />
              <div>
                <h3>Inventory Status</h3>
                <p>{inventoryData.length} items</p>
                <small>
                  {inventoryStatus.lowStock} low stock, {inventoryStatus.outOfStock} out stock
                </small>
              </div>
            </div>

            <div className="metric-card production-metric">
              <FiTruck className="metric-icon" />
              <div>
                <h3>Work Orders</h3>
                <p>{workOrders.length} total</p>
                <small>
                  {pendingWorkOrders.length} pending sales
                </small>
              </div>
            </div>
          </div>

          {/* Pending Actions Section - Temporarily hidden since routes are commented out */}
          {/* <div className="pending-actions">
            <div className="pending-section work-orders-pending">
              <h3><FiClock /> Pending Work Orders</h3>
              <div className="pending-list">
                <div className="pending-grid">
                  {pendingWorkOrders.slice(0, 4).map(wo => (
                    <div key={wo.workOrderNumber} className="pending-item">
                      <p>WO #{wo.workOrderNumber}</p>
                      <small>
                        {wo.workOrderDate} • {wo.items?.length || 0} items
                      </small>
                    </div>
                  ))}
                </div>
                {pendingWorkOrders.length === 0 && (
                  <div className="no-pending">All work orders have sales</div>
                )}
              </div>
            </div>

            <div className="pending-section grns-pending">
              <h3><FiClock /> Pending GRNs</h3>
              <div className="pending-list">
                <div className="pending-grid">
                  {pendingGRNs.slice(0, 4).map(po => (
                    <div key={po.poNumber} className="pending-item">
                      <p>PO #{po.poNumber}</p>
                      <small>
                        {po.date} • Vendor: {po.vendorName}
                      </small>
                    </div>
                  ))}
                </div>
                {pendingGRNs.length === 0 && (
                  <div className="no-pending">All POs have GRNs</div>
                )}
              </div>
            </div>
          </div> */}

          {/* Charts Section */}
          <div className="charts-section">
            <div className="chart-container">
              <div className="chart-header">
                <h3>Sales Trend (Last 6 Months)</h3>
                <div className="chart-legend">
                  <div className="legend-item">
                    <div className="legend-color sales"></div>
                    <span>Sales (₹)</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={processChartData(salesData, "sales")}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value.split('-')[1]}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `₹${value / 1000}k`}
                  />
                  <Tooltip
                    formatter={(value) => [`₹${value.toLocaleString()}`, "Sales"]}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#8884d8"
                    strokeWidth={3}
                    dot={{ r: 5 }}
                    activeDot={{ r: 8, stroke: '#8884d8', strokeWidth: 2 }}
                    name="Sales"
                  />
                  <ReferenceLine y={0} stroke="#ccc" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-container">
              <div className="chart-header">
                <h3>Purchase Trend (Last 6 Months)</h3>
                <div className="chart-legend">
                  <div className="legend-item">
                    <div className="legend-color purchases"></div>
                    <span>Purchases (₹)</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={processChartData(purchaseData, "purchase")}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value.split('-')[1]}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `₹${value / 1000}k`}
                  />
                  <Tooltip
                    formatter={(value) => [`₹${value.toLocaleString()}`, "Purchases"]}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Bar
                    dataKey="value"
                    fill="#82ca9d"
                    radius={[4, 4, 0, 0]}
                    name="Purchases"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Navbar>

      {/* Expiry Alert Modal */}
      {showExpiryModal && (
        <div className="modal-overlay" onClick={() => {
          setShowExpiryModal(false);
          setItemsToShow(6);
          document.body.classList.remove('modal-open');
        }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <FiCalendar className="icon-expiry" /> Products Expiring Soon (Within 3 Months)
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowExpiryModal(false);
                  setItemsToShow(6);
                  document.body.classList.remove('modal-open');
                }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="inventory-list">
                {expiringItems.slice(0, itemsToShow).map((item, index) => (
                  <div key={`${item.inventoryId}-${item.batchNumber}-${index}`} className="inventory-item">
                    <div className="item-info">
                      <span className="item-name">{item.productName}</span>
                      <span className="item-batch">Batch: {item.batchNumber}</span>
                    </div>
                    <div className="item-details">
                      <span className="item-stock">Qty: {item.quantity}</span>
                      <span className="item-expiry">
                        Expires: {new Date(item.expiryDate).toLocaleDateString()} 
                        ({item.daysUntilExpiry} days)
                      </span>
                    </div>
                  </div>
                ))}
                {expiringItems.length === 0 && (
                  <div className="no-items">No products expiring within 3 months</div>
                )}
              </div>
              {itemsToShow < expiringItems.length && (
                <button
                  className="load-more-btn"
                  onClick={() => setItemsToShow(prev => prev + 6)}
                >
                  Load More
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Low Stock Modal */}
      {showLowStockModal && (
        <div className="modal-overlay" onClick={() => {
          setShowLowStockModal(false);
          setItemsToShow(6);
          document.body.classList.remove('modal-open');
        }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <FiAlertTriangle className="icon-warning" /> Low Stock Items
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowLowStockModal(false);
                  setItemsToShow(6);
                  document.body.classList.remove('modal-open');
                }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="inventory-list">
                {lowStockItems.slice(0, itemsToShow).map(item => (
                  <div key={item.inventoryId} className="inventory-item">
                    <span className="item-name">{item.productName}</span>
                    <span className="item-stock">
                      {item.totalQuantity} left (min: {item.minimumQty || 0})
                    </span>
                    <FiPlusCircle
                      className="order-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOrderItem(item);
                      }}
                      title="Create Purchase Order for this item"
                    />
                  </div>
                ))}
              </div>
              {itemsToShow < lowStockItems.length && (
                <button
                  className="load-more-btn"
                  onClick={() => setItemsToShow(prev => prev + 6)}
                >
                  Load More
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Out of Stock Modal */}
      {showOutOfStockModal && (
        <div className="modal-overlay" onClick={() => {
          setShowOutOfStockModal(false);
          setItemsToShow(6);
          document.body.classList.remove('modal-open');
        }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <FiAlertTriangle className="icon-danger" /> Out of Stock Items
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowOutOfStockModal(false);
                  setItemsToShow(6);
                  document.body.classList.remove('modal-open');
                }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="inventory-list">
                {outOfStockItems.slice(0, itemsToShow).map(item => (
                  <div key={item.inventoryId} className="inventory-item">
                    <span className="item-name">{item.productName}</span>
                    <span className="item-status">Out of stock</span>
                    {/* <FiPlusCircle
                      className="order-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOrderItem(item);
                      }}
                      title="Create Purchase Order for this item"
                    /> */}
                  </div>
                ))}
              </div>
              {itemsToShow < outOfStockItems.length && (
                <button
                  className="load-more-btn"
                  onClick={() => setItemsToShow(prev => prev + 6)}
                >
                  Load More
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;