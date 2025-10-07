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

  // Enhanced processChartData function to handle different data structures
  const processChartData = (data, type) => {
    if (!Array.isArray(data)) {
      console.error(`Expected array for ${type} data, got:`, typeof data);
      return [];
    }

    if (data.length === 0) {
      console.warn(`No data available for ${type} chart`);
      return generateEmptyChartData(); // Return empty data for last 6 months
    }

    const dateField = type === "sales" ? "invoiceDate" : "date";
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

    const chartData = Object.values(monthlyData)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-6);

    return chartData.length > 0 ? chartData : generateEmptyChartData();
  };

  // Generate empty chart data for last 6 months when no data is available
  const generateEmptyChartData = () => {
    const today = new Date();
    const emptyData = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(today.getMonth() - i);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      emptyData.push({
        date: monthYear,
        value: 0,
        count: 0
      });
    }
    
    return emptyData;
  };

  // Calculate total sales amount
  const getTotalSales = () => {
    return salesData.reduce((sum, sale) => sum + (sale?.total || 0), 0);
  };

  // Calculate total purchase amount - since we don't have purchase data, we'll calculate from inventory batches
  const getTotalPurchases = () => {
    let totalPurchases = 0;
    
    inventoryData.forEach(item => {
      if (item.batches && Array.isArray(item.batches)) {
        item.batches.forEach(batch => {
          // If we have price in batches, use it, otherwise estimate
          if (batch.price) {
            totalPurchases += (batch.price * batch.quantity);
          } else if (item.price) {
            totalPurchases += (item.price * batch.quantity);
          }
        });
      }
    });
    
    return totalPurchases;
  };

  // Get purchase count from inventory batches
  const getPurchaseCount = () => {
    let batchCount = 0;
    inventoryData.forEach(item => {
      if (item.batches && Array.isArray(item.batches)) {
        batchCount += item.batches.length;
      }
    });
    return batchCount;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Starting data fetch...");

        // Fetch sales and inventory data
        const urls = [
          `${import.meta.env.VITE_API_URL}/invoices/get-invoices`,
          `${import.meta.env.VITE_API_URL}/inventory/get-inventory`,
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
                return { success: false, data: [] };
              })
          )
        );

        const [salesResponse, inventoryResponse] = responses;

        const sales = salesResponse.success ? salesResponse.data : [];
        const inventory = inventoryResponse.success ? inventoryResponse.data : [];

        console.log("Extracted data:", {
          sales: sales.length,
          inventory: inventory.length,
        });

        setSalesData(Array.isArray(sales) ? sales : []);
        setInventoryData(Array.isArray(inventory) ? inventory : []);
        
        // For purchase data, we'll use inventory data since we don't have separate purchase API
        // This assumes inventory batches represent purchases
        setPurchaseData(Array.isArray(inventory) ? inventory : []);
        
        // Set empty arrays for other data
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

  // Process purchase data for charts (using inventory batches as purchase data)
  const processPurchaseChartData = (inventoryData) => {
    if (!Array.isArray(inventoryData) || inventoryData.length === 0) {
      return generateEmptyChartData();
    }

    const monthlyData = {};

    inventoryData.forEach(item => {
      if (item.batches && Array.isArray(item.batches)) {
        item.batches.forEach(batch => {
          if (batch.addedAt) {
            const date = new Date(batch.addedAt);
            const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyData[monthYear]) {
              monthlyData[monthYear] = { date: monthYear, value: 0, count: 0 };
            }
            
            // Calculate batch value
            const batchValue = batch.price ? (batch.price * batch.quantity) : 
                              item.price ? (item.price * batch.quantity) : 0;
            
            monthlyData[monthYear].value += batchValue;
            monthlyData[monthYear].count += 1;
          }
        });
      }
    });

    const chartData = Object.values(monthlyData)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-6);

    return chartData.length > 0 ? chartData : generateEmptyChartData();
  };

  // Inventory status
  const inventoryStatus = inventoryData.reduce(
    (acc, item) => {
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

  const totalSales = getTotalSales();
  const totalPurchases = getTotalPurchases();
  const purchaseCount = getPurchaseCount();
  const salesChartData = processChartData(salesData, "sales");
  const purchaseChartData = processPurchaseChartData(inventoryData);

  return (
    <div>
      <Navbar>
        <div className="dashboard-container">
          {/* Inventory Alerts */}
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

          {/* Key Metrics - Updated with actual data */}
          <div className="metrics-grid">
            <div className="metric-card sales-metric">
              <FiDollarSign className="metric-icon" />
              <div>
                <h3>Total Sales</h3>
                <p>₹{totalSales.toLocaleString()}</p>
                <small>{salesData.length} invoices</small>
              </div>
            </div>

            <div className="metric-card purchases-metric">
              <FiShoppingCart className="metric-icon" />
              <div>
                <h3>Total Purchases</h3>
                <p>₹{totalPurchases.toLocaleString()}</p>
                <small>{purchaseCount} batches</small>
              </div>
            </div>

            <div className="metric-card inventory-metric">
              <FiPackage className="metric-icon" />
              <div>
                <h3>Inventory Status</h3>
                <p>{inventoryData.length} items</p>
                <small>
                  {inventoryStatus.lowStock} low stock, {inventoryStatus.outOfStock} out of stock
                </small>
              </div>
            </div>

            {/* <div className="metric-card production-metric">
              <FiTruck className="metric-icon" />
              <div>
                <h3>Work Orders</h3>
                <p>{workOrders.length} total</p>
                <small>
                  {workOrders.filter(wo => !salesData.some(sale => sale.workOrderNumber === wo.workOrderNumber)).length} pending sales
                </small>
              </div>
            </div> */}
          </div>

          {/* Charts Section - Updated with proper data */}
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
                <LineChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const [year, month] = value.split('-');
                      return `${month}/${year.slice(2)}`;
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      if (value >= 100000) return `₹${(value / 100000).toFixed(0)}L`;
                      if (value >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
                      return `₹${value}`;
                    }}
                  />
                  <Tooltip
                    formatter={(value) => [`₹${Number(value).toLocaleString()}`, "Sales"]}
                    labelFormatter={(label) => {
                      const [year, month] = label.split('-');
                      return `Month: ${month}/${year}`;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#8884d8"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6, stroke: '#8884d8', strokeWidth: 2 }}
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
                <BarChart data={purchaseChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const [year, month] = value.split('-');
                      return `${month}/${year.slice(2)}`;
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      if (value >= 100000) return `₹${(value / 100000).toFixed(0)}L`;
                      if (value >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
                      return `₹${value}`;
                    }}
                  />
                  <Tooltip
                    formatter={(value) => [`₹${Number(value).toLocaleString()}`, "Purchases"]}
                    labelFormatter={(label) => {
                      const [year, month] = label.split('-');
                      return `Month: ${month}/${year}`;
                    }}
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

      {/* Modals remain the same */}
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