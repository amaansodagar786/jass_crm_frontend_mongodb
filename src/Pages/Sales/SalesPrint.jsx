import React from "react";
import "./Salesprint.scss";
import logo from "../../Assets/logo/jass_logo1.png";

const SalesPrint = ({ invoice }) => {
  if (!invoice) return null;

  const {
    invoiceNumber,
    date,
    customer,
    items,
    paymentType,
    subtotal,
    baseValue,
    discount,
    cgst,
    sgst,
    tax,
    hasMixedTaxRates,
    total
  } = invoice;

  const companyInfo = {
    sfpNumber: "SFP-2023-001",
  };

  const termsAndConditions = `
  1. All goods sold are subject to our terms and conditions.
  `;

  // Calculate discounted total for each item
  const calculateItemDiscountedTotal = (item) => {
    const quantity = item.quantity || 1;
    const price = item.price || 0;
    const discountPercentage = item.discount || 0;
    
    const itemTotal = price * quantity;
    const discountAmount = itemTotal * (discountPercentage / 100);
    return itemTotal - discountAmount;
  };

  // Safe number formatting
  const formatCurrency = (value) => {
    if (value === undefined || value === null) return "₹0.00";
    return `₹${Number(value).toFixed(2)}`;
  };

  // Safe number formatting without symbol
  const formatNumber = (value) => {
    if (value === undefined || value === null) return "0.00";
    return Number(value).toFixed(2);
  };

  return (
    <div id="sales-pdf">
      <div className="invoice-container">

        {/* Top Logo */}
        <div className="invoice-header">
          <div className="invoice-logo">
            <img src={logo} alt="Company Logo" />
          </div>
          <div className="company-info">
            <p>Patel Enterprise </p>
            <p>24AAAFP0763BAZV</p>
          </div>
        </div>

        {/* Invoice + Billing Section */}
        <div className="invoice-details-section">
          <div className="customer-info">
            <h3>Billing Details</h3>
            <table className="details-table">
              <tbody>
                <tr>
                  <td>Customer Name:</td>
                  <td>{customer?.name || "N/A"}</td>
                </tr>
                {customer?.email && (
                  <tr>
                    <td>Email:</td>
                    <td>{customer.email}</td>
                  </tr>
                )}
                {customer?.mobile && (
                  <tr>
                    <td>Mobile:</td>
                    <td>{customer.mobile}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="invoice-info">
            <h3>Invoice Details</h3>
            <table className="details-table">
              <tbody>
                <tr>
                  <td>Invoice Number:</td>
                  <td>{invoiceNumber || "N/A"}</td>
                </tr>
                <tr>
                  <td>Date:</td>
                  <td>{date || "N/A"} {new Date().toLocaleTimeString()}</td>
                </tr>
                <tr>
                  <td>Payment Type:</td>
                  <td>{(paymentType || "N/A").toUpperCase()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Items Table */}
        <div className="items-section">
          <h3>Items Details</h3>
          <table className="items-table">
            <thead>
              <tr>
                <th>Sr No</th>
                <th>Barcode</th>
                <th>Product Name</th>
                <th>HSN</th>
                <th>Qty</th>
                <th>Price (Incl. Tax)</th>
                <th>Discount %</th>
                <th>Total</th> {/* Added Total column */}
              </tr>
            </thead>
            <tbody>
              {items && items.map((item, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{item.barcode || "N/A"}</td>
                  <td>{item.name || "N/A"}</td>
                  <td>{item.hsn || "N/A"}</td>
                  <td>{item.quantity || 1}</td>
                  <td>{formatCurrency(item.price)}</td>
                  <td>{formatNumber(item.discount)}%</td>
                  <td>{formatCurrency(calculateItemDiscountedTotal(item))}</td> {/* Added Total value */}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="totals-section">
          <div className="amount-details">
            <table>
              <tbody>
                <tr>
                  <td>Subtotal (Incl. Tax):</td>
                  <td>{formatCurrency(subtotal)}</td>
                </tr>
                <tr>
                  <td>Base Value:</td>
                  <td>{formatCurrency(baseValue)}</td>
                </tr>
                <tr>
                  <td>Discount:</td>
                  <td>{formatCurrency(discount)}</td>
                </tr>
                
                {/* Show CGST/SGST only if no mixed tax rates */}
                {!hasMixedTaxRates && cgst > 0 && sgst > 0 && (
                  <>
                    <tr>
                      <td>CGST ({invoice.taxPercentages && invoice.taxPercentages[0] ? invoice.taxPercentages[0] / 2 : 9}%):</td>
                      <td>{formatCurrency(cgst)}</td>
                    </tr>
                    <tr>
                      <td>SGST ({invoice.taxPercentages && invoice.taxPercentages[0] ? invoice.taxPercentages[0] / 2 : 9}%):</td>
                      <td>{formatCurrency(sgst)}</td>
                    </tr>
                  </>
                )}
                
                {/* Show GST only if mixed tax rates */}
                {hasMixedTaxRates && tax > 0 && (
                  <tr>
                    <td>GST:</td>
                    <td>{formatCurrency(tax)}</td>
                  </tr>
                )}
                
                <tr className="grand-total">
                  <td>Grand Total:</td>
                  <td>{formatCurrency(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Terms */}
        <div className="terms-section">
          <h3>Terms & Conditions</h3>
          <pre>{termsAndConditions}</pre>
        </div>

        {/* Footer */}
        <div className="invoice-footer">
          <div className="thank-you">
            <p>Thank you for your business!</p>
          </div>
          <div className="signature">
            <p>Authorized Signature</p>
            <div className="signature-line"></div>
          </div>
          <div className="developer-note">
            <p>Developed by Techorses</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesPrint;