import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { getPosOrderById, PosOrderDetail } from '../../../services/api/posService';

export default function SellerPosOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<PosOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const fetchOrder = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getPosOrderById(id);
        if (response.success) {
          setOrder(response.data);
        } else {
          setError(response.message || 'Failed to fetch POS order');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch POS order');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const handlePrint = () => window.print();

  // A variation value that is a raw 24-char hex MongoDB ObjectId is not
  // human-readable — skip showing it in the receipt.
  const isObjectId = (val?: string) => !!val && /^[a-f0-9]{24}$/i.test(val.trim());
  const readableVariation = (val?: string) => (isObjectId(val) ? '' : val || '');

  const handleExportPDF = () => {
    if (!order) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let yPos = margin;

    doc.setFillColor(22, 163, 74);
    doc.rect(margin, yPos, contentWidth, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(order.seller.storeName || 'In-Store Receipt', margin + 5, yPos + 10);
    yPos += 22;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (order.seller.address) {
      doc.text(order.seller.address, margin, yPos);
      yPos += 6;
    }
    doc.text(`Receipt #: ${order.orderNumber}`, margin, yPos);
    yPos += 6;
    doc.text(`Date: ${new Date(order.orderDate).toLocaleString()}`, margin, yPos);
    yPos += 6;
    doc.text(`Customer: ${order.customerName}${order.customerPhone && order.customerPhone !== '0000000000' ? ' (' + order.customerPhone + ')' : ''}`, margin, yPos);
    yPos += 10;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos, contentWidth, 10, 'F');
    const colWidths = [contentWidth * 0.45, contentWidth * 0.2, contentWidth * 0.15, contentWidth * 0.2];
    let xPos = margin;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    ['Item', 'Unit Price', 'Qty', 'Total'].forEach((h, i) => {
      doc.text(h, xPos + 2, yPos + 7);
      xPos += colWidths[i];
    });
    yPos += 12;

    doc.setFont('helvetica', 'normal');
    order.items.forEach((item) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = margin;
      }
      xPos = margin;
      const varLabel = readableVariation(item.variation);
      const label = varLabel ? `${item.product} (${varLabel})` : item.product;
      const row = [label, `Rs. ${item.unitPrice.toFixed(2)}`, String(item.qty), `Rs. ${item.total.toFixed(2)}`];
      row.forEach((val, i) => {
        doc.text(String(val), xPos + 2, yPos + 5);
        xPos += colWidths[i];
      });
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, yPos + 8, pageWidth - margin, yPos + 8);
      yPos += 10;
    });

    yPos += 6;
    doc.setFontSize(10);
    doc.text('Subtotal:', pageWidth - margin - 60, yPos, { align: 'right' });
    doc.text(`Rs. ${order.subtotal.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 7;
    doc.text('Tax:', pageWidth - margin - 60, yPos, { align: 'right' });
    doc.text(`Rs. ${order.tax.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 7;
    doc.text('Discount:', pageWidth - margin - 60, yPos, { align: 'right' });
    doc.text(`- Rs. ${order.discount.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Grand Total:', pageWidth - margin - 60, yPos, { align: 'right' });
    doc.text(`Rs. ${order.grandTotal.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Payment: ${order.paymentMethod} (${order.paymentStatus})`, margin, yPos);
    yPos += 12;

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74);
    doc.text('Thank you for your purchase from Speedoo', pageWidth / 2, yPos, { align: 'center' });

    doc.save(`POS_Receipt_${order.orderNumber}.pdf`);
  };

  if (loading) {
    return <div className="p-8 text-center text-neutral-500">Loading receipt...</div>;
  }
  if (error || !order) {
    return <div className="p-4 m-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error || 'Order not found'}</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6">
      <div className="bg-white border-b border-neutral-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">POS Receipt</h1>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Link to="/seller" className="text-blue-600 hover:text-blue-700">Home</Link>
            <span className="text-neutral-500">/</span>
            <Link to="/seller/pos/history" className="text-blue-600 hover:text-blue-700">POS History</Link>
            <span className="text-neutral-500">/</span>
            <span className="text-neutral-700">{order.orderNumber}</span>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-4 md:px-6">
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-green-600 text-white px-4 sm:px-6 py-3 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold">Order #{order.orderNumber}</h2>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="bg-white text-green-700 hover:bg-green-50 px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors"
              >
                Print
              </button>
              <button
                onClick={handleExportPDF}
                className="bg-white text-green-700 hover:bg-green-50 px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors"
              >
                Export PDF
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-b border-neutral-200">
            <div>
              <p className="text-neutral-500">Date</p>
              <p className="text-neutral-900 font-medium">{new Date(order.orderDate).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-neutral-500">Customer</p>
              <p className="text-neutral-900 font-medium">
                {order.customerName}
                {order.customerPhone && order.customerPhone !== '0000000000' ? ` (${order.customerPhone})` : ''}
              </p>
            </div>
            <div>
              <p className="text-neutral-500">Payment Method</p>
              <p className="text-neutral-900 font-medium">{order.paymentMethod}</p>
            </div>
            <div>
              <p className="text-neutral-500">Payment Status</p>
              <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                {order.paymentStatus}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Item</th>
                  <th className="px-4 sm:px-6 py-2 sm:py-3 text-right text-xs font-semibold text-neutral-700 uppercase tracking-wider">Unit Price</th>
                  <th className="px-4 sm:px-6 py-2 sm:py-3 text-right text-xs font-semibold text-neutral-700 uppercase tracking-wider">Qty</th>
                  <th className="px-4 sm:px-6 py-2 sm:py-3 text-right text-xs font-semibold text-neutral-700 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {order.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900">
                      {item.product}
                      {readableVariation(item.variation) && <span className="text-neutral-500"> ({readableVariation(item.variation)})</span>}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-700 text-right">₹{item.unitPrice.toFixed(2)}</td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-700 text-right">{item.qty}</td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900 font-medium text-right">₹{item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 sm:p-6 flex justify-end">
            <div className="w-full sm:w-64 space-y-1 text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span>
                <span>₹{order.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Tax</span>
                <span>₹{order.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Discount</span>
                <span>- ₹{order.discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-neutral-900 text-base pt-2 border-t border-neutral-200">
                <span>Grand Total</span>
                <span>₹{order.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
