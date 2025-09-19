import React from "react";
import "./Salesprint.scss";
import logo from "../../Assets/logo/jass_logo.png";

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
    total
  } = invoice;

  const companyInfo = {
    sfpNumber: "SFP-2023-001",
  };

  const formatDiscount = (discount) => {
    return discount === "" ? 0 : discount;
  };

  const termsAndConditions = `
  1. All goods sold are subject to our terms and conditions.
  `;

  // Calculate item totals with the new GST calculation method
  const calculateItemTotal = (item) => {
    const quantity = item.quantity || 1;
    const taxRate = item.taxSlab || 18;
    const taxMultiplier = 1 + (taxRate / 100);

    // Calculate base value for this item
    const itemBaseValue = (item.price * quantity) / taxMultiplier;

    // Apply discount to this item
    const discountPercentage = item.discount || 0;
    const itemDiscountAmount = itemBaseValue * (discountPercentage / 100);
    const itemDiscountedBase = itemBaseValue - itemDiscountAmount;

    // Recalculate tax for this item
    const itemTaxAfterDiscount = itemDiscountedBase * (taxRate / 100);

    // Total amount for this item
    return itemDiscountedBase + itemTaxAfterDiscount;
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
            <p>SFP Sons India Pvt Ltd</p>
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
                  <td>{customer.name}</td>
                </tr>
                {/* <tr>
                  <td>Customer ID:</td>
                  <td>{customer.customerNumber}</td>
                </tr> */}
                {customer.email && (
                  <tr>
                    <td>Email:</td>
                    <td>{customer.email}</td>
                  </tr>
                )}
                {customer.mobile && (
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
                  <td>{invoiceNumber}</td>
                </tr>
                <tr>
                  <td>Date:</td>
                  <td>{date} {new Date().toLocaleTimeString()}</td>
                </tr>
                {/* <tr>
                  <td>SFP Number:</td>
                  <td>{companyInfo.sfpNumber}</td>
                </tr> */}

                <tr>
                  <td>Payment Type:</td>
                  <td>{paymentType.toUpperCase()}</td>
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
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{item.barcode}</td>
                  <td>{item.name}</td>
                  <td>{item.hsn}</td>
                  <td>{item.quantity}</td>
                  <td>₹{item.price.toFixed(2)}</td>
                  <td>{item.discount}%</td>
                  <td>₹{calculateItemTotal(item).toFixed(2)}</td>
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
                  <td>₹{subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Base Value:</td>
                  <td>₹{baseValue.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Discount:</td>
                  <td>₹{discount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>CGST (9%):</td>
                  <td>₹{cgst.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>SGST (9%):</td>
                  <td>₹{sgst.toFixed(2)}</td>
                </tr>
                <tr className="grand-total">
                  <td>Grand Total:</td>
                  <td>₹{total.toFixed(2)}</td>
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