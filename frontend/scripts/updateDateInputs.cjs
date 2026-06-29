const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, '../src/modules/admin/pages');

const filesToUpdate = [
  'AdminPendingOrders.tsx',
  'AdminProcessedOrders.tsx',
  'AdminShippedOrders.tsx',
  'AdminOutForDeliveryOrders.tsx',
  'AdminDeliveredOrders.tsx',
  'AdminCancelledOrders.tsx',
  'AdminReceivedOrders.tsx',
];

filesToUpdate.forEach(file => {
  const filePath = path.join(directoryPath, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Add max={dateTo || undefined}
    content = content.replace(/onChange=\{\(e\) => \{\s*setDateFrom\(e\.target\.value\);\s*setCurrentPage\(1\);\s*\}\}\s*className="border-none/g, 
    `onChange={(e) => {\n                        setDateFrom(e.target.value);\n                        setCurrentPage(1);\n                      }}\n                      max={dateTo || undefined}\n                      className="border-none`);

    // Add min={dateFrom || undefined}
    content = content.replace(/onChange=\{\(e\) => \{\s*setDateTo\(e\.target\.value\);\s*setCurrentPage\(1\);\s*\}\}\s*className="border-none/g, 
    `onChange={(e) => {\n                        setDateTo(e.target.value);\n                        setCurrentPage(1);\n                      }}\n                      min={dateFrom || undefined}\n                      className="border-none`);

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
