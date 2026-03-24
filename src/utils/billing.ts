import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Sale, UserProfile, Product } from '../types';

export const generateInvoicePDF = (sale: Sale, profile: UserProfile | null) => {
  const doc = new jsPDF();
  const dateStr = format(new Date(sale.soldAt), 'dd.MM.yyyy');
  const dueDateStr = format(new Date(new Date(sale.soldAt).getTime() + 14 * 24 * 60 * 60 * 1000), 'dd.MM.yyyy');
  const invoiceNo = sale.id.substring(0, 5).toUpperCase();

  // Background color
  doc.setFillColor(245, 242, 237);
  doc.rect(0, 0, 210, 297, 'F');

  // Title "Invoice"
  doc.setFont('times', 'italic');
  doc.setFontSize(80);
  doc.setTextColor(26, 26, 26);
  doc.text('Invoice', 14, 45);

  // Invoice Details (Top Right)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text('INVOICE NO:', 140, 25);
  doc.text('date:', 140, 32);
  doc.text('due date:', 140, 39);

  doc.setTextColor(26, 26, 26);
  doc.text(invoiceNo, 190, 25, { align: 'right' });
  doc.text(dateStr, 190, 32, { align: 'right' });
  doc.text(dueDateStr, 190, 39, { align: 'right' });

  // Billed To / From
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('BILLED TO:', 30, 70);
  doc.setFont('helvetica', 'normal');
  doc.text('Customer', 55, 70);
  doc.text('Valued Client', 55, 76);
  doc.text('N/A', 55, 82);

  doc.setDrawColor(200, 180, 150);
  doc.line(30, 88, 110, 88);

  doc.setFont('helvetica', 'bold');
  doc.text('FROM:', 30, 98);
  doc.setFont('helvetica', 'normal');
  doc.text(profile?.displayName || 'Your Shop Name', 45, 98);
  doc.text('SmartStock Partner', 45, 104);
  doc.text(profile?.email || 'N/A', 45, 110);
  doc.text(profile?.whatsappNumber ? `+${profile.whatsappNumber}` : 'N/A', 45, 116);

  // Logo (Circle)
  doc.setFillColor(200, 180, 150);
  doc.circle(160, 90, 20, 'F');
  doc.setFont('times', 'italic');
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text('logo', 160, 92, { align: 'center' });

  // Table
  const tableData = [
    [
      sale.productName,
      `INR ${sale.totalAmount / sale.quantitySold}`,
      sale.quantitySold.toString(),
      `INR ${sale.totalAmount}`
    ]
  ];

  autoTable(doc, {
    startY: 130,
    head: [['DESCRIPTION', 'UNIT PRICE', 'QTY', 'TOTAL']],
    body: tableData,
    theme: 'plain',
    headStyles: { 
      textColor: [26, 26, 26], 
      fontStyle: 'bold', 
      fontSize: 10,
      halign: 'center'
    },
    styles: { 
      fontSize: 10, 
      cellPadding: 5, 
      textColor: [26, 26, 26],
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'left' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY;

  // Totals
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBTOTAL', 30, finalY + 15);
  doc.text(`INR ${sale.totalAmount}`, 180, finalY + 15, { align: 'right' });

  doc.setDrawColor(26, 26, 26);
  doc.line(30, finalY + 8, 180, finalY + 8);
  doc.line(30, finalY + 22, 180, finalY + 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Tax', 150, finalY + 32);
  doc.text('0%', 180, finalY + 32, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text('DISCOUNT', 150, finalY + 38);
  doc.text('-₹0', 180, finalY + 38, { align: 'right' });
  doc.setFontSize(11);
  doc.text('TOTAL', 150, finalY + 44);
  doc.text(`INR ${sale.totalAmount}`, 180, finalY + 44, { align: 'right' });

  // Payment Options
  doc.setFontSize(14);
  doc.setFont('times', 'italic');
  doc.text('PAYMENT OPTIONS:', 14, finalY + 60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('PAYPAL: PAYPAL USERNAME', 14, finalY + 68);
  doc.text('VENMO: VENMO USERNAME', 14, finalY + 74);
  doc.text('CASHAPP: CASHTAG', 14, finalY + 80);
  doc.text('ZELLE: EMAIL/PHONE NUMBER', 14, finalY + 86);
  doc.text('CASH', 14, finalY + 92);
  doc.text('CHECK', 14, finalY + 98);

  // Thank you
  doc.setFont('times', 'italic');
  doc.setFontSize(40);
  doc.text('thank you!', 190, finalY + 80, { align: 'right' });

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('@SMARTSTOCK | INVENTORY SOLUTIONS', 190, finalY + 110, { align: 'right' });

  doc.save(`Invoice_${invoiceNo}.pdf`);
};

export const formatWhatsAppNumber = (number: string) => {
  // Remove all non-numeric characters
  let cleaned = number.replace(/\D/g, '');
  
  // If it's 10 digits, assume India (91)
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  
  return cleaned;
};

export const sendWhatsAppInvoice = (sale: Sale, profile: UserProfile | null) => {
  if (!profile?.whatsappNumber) return false;

  const invoiceNo = `INV-${sale.id.substring(0, 8).toUpperCase()}`;
  const dateStr = format(new Date(sale.soldAt), 'dd-MMM-yyyy');
  const formattedPhone = formatWhatsAppNumber(profile.whatsappNumber);
  
  const message = `*INVOICE / BILL*\n\n` +
    `*Shop:* ${profile.displayName}\n` +
    `*Invoice No:* ${invoiceNo}\n` +
    `*Date:* ${dateStr}\n\n` +
    `*TOTAL AMOUNT: ₹${sale.totalAmount}*\n` +
    `*Items Sold: ${sale.quantitySold}*\n\n` +
    `*Sales Details:*\n` +
    `- ${sale.productName} x ${sale.quantitySold} = ₹${sale.totalAmount}\n\n` +
    `Thank you for shopping with us!`;

  const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  return true;
};

export const sendWhatsAppDailySummary = (sales: Sale[], profile: UserProfile | null, lowStockItems: Product[] = []) => {
  if (!profile?.whatsappNumber) return false;

  const today = new Date();
  const dateStr = format(today, 'dd-MMM-yyyy');
  const totalAmount = sales.reduce((acc, s) => acc + s.totalAmount, 0);
  const totalItems = sales.reduce((acc, s) => acc + s.quantitySold, 0);
  
  // Group sales by product name
  const groupedSales: { [name: string]: { qty: number, total: number } } = {};
  sales.forEach(s => {
    if (!groupedSales[s.productName]) {
      groupedSales[s.productName] = { qty: 0, total: 0 };
    }
    groupedSales[s.productName].qty += s.quantitySold;
    groupedSales[s.productName].total += s.totalAmount;
  });

  const salesList = Object.entries(groupedSales)
    .map(([name, data]) => `- ${name} x ${data.qty} = ₹${data.total}`)
    .join('\n');
  
  const formattedPhone = formatWhatsAppNumber(profile.whatsappNumber);
  
  let message = `*DAILY SHOP SUMMARY*\n\n` +
    `*Shop:* ${profile.displayName}\n` +
    `*Date:* ${dateStr}\n\n`;

  if (sales.length > 0) {
    message += `*TOTAL SALES: ₹${totalAmount}*\n` +
      `*Items Sold: ${totalItems}*\n\n` +
      `*Sales Details:*\n` +
      salesList + `\n\n`;
  } else {
    message += `No sales recorded today.\n\n`;
  }

  if (lowStockItems.length > 0) {
    message += `*⚠️ LOW STOCK ALERTS:*\n` +
      lowStockItems.map(p => `- ${p.name} (${p.quantity} left)`).join('\n') + `\n\n`;
  }

  message += `Great job today!`;

  const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  return true;
};
