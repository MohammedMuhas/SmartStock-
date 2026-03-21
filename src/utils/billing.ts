import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Sale, UserProfile, Product } from '../types';

export const generateInvoicePDF = (sale: Sale, profile: UserProfile | null) => {
  const doc = new jsPDF();
  const dateStr = format(new Date(sale.soldAt), 'dd-MMM-yyyy HH:mm');
  const invoiceNo = `INV-${sale.id.substring(0, 8).toUpperCase()}`;

  // Header
  doc.setFontSize(24);
  doc.setTextColor(5, 150, 105); // Emerald 600
  doc.text(profile?.displayName || 'SmartStock Shop', 14, 25);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('INVOICE / BILL', 14, 32);

  // Shop Details
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`Shop Name: ${profile?.displayName || 'N/A'}`, 14, 45);
  doc.text(`Email: ${profile?.email || 'N/A'}`, 14, 50);
  if (profile?.whatsappNumber) {
    const displayPhone = formatWhatsAppNumber(profile.whatsappNumber);
    doc.text(`WhatsApp: +${displayPhone}`, 14, 55);
  }

  // Invoice Details
  doc.text(`Invoice No: ${invoiceNo}`, 140, 45);
  doc.text(`Date: ${dateStr}`, 140, 50);

  // Table
  const tableData = [
    [
      sale.productName,
      sale.quantitySold.toString(),
      `INR ${sale.totalAmount / sale.quantitySold}`,
      `INR ${sale.totalAmount}`
    ]
  ];

  autoTable(doc, {
    startY: 70,
    head: [['Product Description', 'Quantity', 'Unit Price', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [5, 150, 105] },
    styles: { fontSize: 10, cellPadding: 5 }
  });

  const finalY = (doc as any).lastAutoTable.finalY;

  // Total
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Grand Total: INR ${sale.totalAmount}`, 140, finalY + 15);

  // Footer
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Thank you for your business!', 105, finalY + 40, { align: 'center' });
  doc.text('This is a computer-generated invoice.', 105, finalY + 45, { align: 'center' });

  doc.save(`${invoiceNo}.pdf`);
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
    `*Items:*\n` +
    `- ${sale.productName} x ${sale.quantitySold} = ₹${sale.totalAmount}\n\n` +
    `*Total Amount: ₹${sale.totalAmount}*\n\n` +
    `Thank you for shopping with us!`;

  const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  return true;
};

export const sendWhatsAppDailySummary = (sales: Sale[], profile: UserProfile | null) => {
  if (!profile?.whatsappNumber) return false;

  const today = new Date();
  const dateStr = format(today, 'dd-MMM-yyyy');
  const totalAmount = sales.reduce((acc, s) => acc + s.totalAmount, 0);
  const totalItems = sales.reduce((acc, s) => acc + s.quantitySold, 0);
  
  const salesList = sales.map(s => `- ${s.productName} x ${s.quantitySold} = ₹${s.totalAmount}`).join('\n');
  
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

  message += `Great job today!`;

  const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  return true;
};
