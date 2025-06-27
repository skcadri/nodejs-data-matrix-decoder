// GS1 Data Matrix Parser and OpenFDA API Test
// Based on the user's image showing: 010034928158905817131028100U42275AA

/**
 * Parse GS1 Data Matrix string into structured data
 * Format: (01)GTIN(17)YYMMDD(10)LOT(21)SERIAL
 */
function parseGS1DataMatrix(data) {
  const result = { raw: data };

  try {
    // Based on the image: 010034928158905817131028100U42275AA
    // 01 + 00349281589058 + 17 + 131028 + 10 + 0U42275AA
    
    let pos = 0;
    
    // Extract GTIN: 01 + 14 digits
    if (data.substring(pos, pos + 2) === '01') {
      pos += 2; // Skip AI
      result.gtin = data.substring(pos, pos + 14);
      result.ndc = convertGTINtoNDC(result.gtin);
      pos += 14;
    }
    
    // Extract Expiration Date: 17 + 6 digits
    if (data.substring(pos, pos + 2) === '17') {
      pos += 2; // Skip AI
      result.expirationDateRaw = data.substring(pos, pos + 6);
      result.expirationDate = formatExpirationDate(result.expirationDateRaw);
      pos += 6;
    }
    
    // Extract Lot Number: 10 + remaining characters
    if (data.substring(pos, pos + 2) === '10') {
      pos += 2; // Skip AI
      result.lotNumber = data.substring(pos); // Take everything remaining
    }

  } catch (error) {
    console.error('Error parsing GS1 data:', error);
  }

  return result;
}

/**
 * Convert 14-digit GTIN to NDC format
 * GTIN: 00349281589058 → NDC: 49281-5890-58
 */
function convertGTINtoNDC(gtin) {
  if (!gtin || gtin.length !== 14) {
    throw new Error('Invalid GTIN format. Expected 14 digits.');
  }

  // For pharmaceutical GTINs, remove the first 3 digits (usually 003)
  // and format the remaining 11 digits as NDC
  const withoutPrefix = gtin.substring(3);
  
  // NDC format: XXXXX-XXXX-XX (5-4-2 format is most common)
  const labeler = withoutPrefix.substring(0, 5);
  const product = withoutPrefix.substring(5, 9);
  const packageCode = withoutPrefix.substring(9, 11);
  
  return `${labeler}-${product}-${packageCode}`;
}

/**
 * Format expiration date from YYMMDD to readable format
 */
function formatExpirationDate(yymmdd) {
  if (!yymmdd || yymmdd.length !== 6) {
    return yymmdd;
  }

  const year = parseInt(yymmdd.substring(0, 2));
  const month = parseInt(yymmdd.substring(2, 4));
  const day = parseInt(yymmdd.substring(4, 6));

  // Assume years 00-30 are 2000s, 31-99 are 1900s
  const fullYear = year <= 30 ? 2000 + year : 1900 + year;

  const date = new Date(fullYear, month - 1, day);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Query OpenFDA API for drug information
 */
async function queryOpenFDA(ndc) {
  try {
    // Format NDC for OpenFDA API - try different search patterns
    const cleanNDC = ndc.replace(/-/g, '');
    const searchPatterns = [
      // Exact match with original NDC
      `product_ndc:"${ndc}"`,
      // Search with labeler-product (without package code)
      `product_ndc:"${cleanNDC.substring(0, 5)}-${cleanNDC.substring(5, 9)}"`,
      // Broader search with labeler code
      `product_ndc:${cleanNDC.substring(0, 5)}*`
    ];

    for (const searchQuery of searchPatterns) {
      const url = `https://api.fda.gov/drug/ndc.json?search=${encodeURIComponent(searchQuery)}&limit=5`;
      console.log(`\n🔍 Trying OpenFDA query: ${searchQuery}`);
      
      try {
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            console.log(`✅ Found result with query: ${searchQuery}`);
            return {
              success: true,
              searchQuery: searchQuery,
              result: data.results[0],
              allResults: data.results
            };
          }
        } else if (response.status === 404) {
          console.log(`❌ No results for query: ${searchQuery}`);
        } else {
          console.log(`⚠️ OpenFDA API error: ${response.status}`);
        }
      } catch (queryError) {
        console.log(`❌ Error with query "${searchQuery}":`, queryError.message);
      }
    }

    return {
      success: false,
      error: 'No matching drug information found in OpenFDA database'
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to fetch drug information: ${error.message}`
    };
  }
}

// Main test function
async function runTest() {
  // Example data from the user's image
  const testData = "010034928158905817131028100U42275AA";

  console.log("🧪 Testing GS1 Data Matrix Parsing");
  console.log("=====================================");
  console.log("Raw Data:", testData);
  console.log();

  // Manual parsing according to the image breakdown:
  console.log("📊 Manual Breakdown (from image):");
  console.log("----------------------------------");
  console.log("01 + 00349281589058 = GTIN");
  console.log("17 + 131028 = Expiration Date"); 
  console.log("10 + 0U42275AA = Lot Number");
  console.log();

  // Parse the GS1 data
  const parsed = parseGS1DataMatrix(testData);

  console.log("📋 Parsed GS1 Data Matrix Elements:");
  console.log("------------------------------------");
  console.log("✓ GTIN:", parsed.gtin || "Not found");
  console.log("✓ NDC:", parsed.ndc || "Not found");
  console.log("✓ Expiration Date:", parsed.expirationDate || "Not found");
  console.log("✓ Expiration (Raw):", parsed.expirationDateRaw || "Not found");
  console.log("✓ Lot Number:", parsed.lotNumber || "Not found");
  console.log("✓ Serial Number:", parsed.serialNumber || "Not found");

  // Verify against expected values from the image
  console.log("\n🎯 Verification against image:");
  console.log("------------------------------");
  console.log("Expected GTIN: 00349281589058");
  console.log("Actual GTIN:  ", parsed.gtin);
  console.log("GTIN Match:   ", parsed.gtin === "00349281589058" ? "✅ YES" : "❌ NO");
  
  console.log("\nExpected NDC: 49281-5890-58");
  console.log("Actual NDC:  ", parsed.ndc);
  console.log("NDC Match:   ", parsed.ndc === "49281-5890-58" ? "✅ YES" : "❌ NO");

  console.log("\nExpected Exp Date: 131028 (Oct 28, 2013)");
  console.log("Actual Exp Raw:   ", parsed.expirationDateRaw);
  console.log("Actual Exp Format:", parsed.expirationDate);

  console.log("\nExpected Lot: 0U42275AA");
  console.log("Actual Lot:  ", parsed.lotNumber);

  // Query OpenFDA API if we have an NDC
  if (parsed.ndc) {
    console.log("\n\n🌐 OpenFDA API Query");
    console.log("=====================");
    console.log("NDC to search:", parsed.ndc);
    
    const fdaResult = await queryOpenFDA(parsed.ndc);
    
    if (fdaResult.success) {
      console.log("\n✅ OpenFDA Results Found!");
      console.log("Search Query Used:", fdaResult.searchQuery);
      
      const drug = fdaResult.result;
      console.log("\n💊 Drug Information:");
      console.log("---------------------");
      console.log("Product NDC:", drug.product_ndc || "N/A");
      console.log("Generic Name:", drug.generic_name || "N/A");
      console.log("Brand Name:", drug.brand_name || drug.brand_name_base || "N/A");
      console.log("Manufacturer:", drug.labeler_name || "N/A");
      console.log("Dosage Form:", drug.dosage_form || "N/A");
      console.log("Route:", drug.route || "N/A");
      console.log("Product Type:", drug.product_type || "N/A");
      console.log("Marketing Status:", drug.marketing_status || "N/A");
      
      if (drug.active_ingredients && drug.active_ingredients.length > 0) {
        console.log("Active Ingredients:");
        drug.active_ingredients.forEach((ing, index) => {
          console.log(`  ${index + 1}. ${ing.name}: ${ing.strength}`);
        });
      }
      
      if (drug.packaging && drug.packaging.length > 0) {
        console.log("Package Information:");
        drug.packaging.forEach((pkg, index) => {
          console.log(`  ${index + 1}. ${pkg.description} (NDC: ${pkg.package_ndc})`);
        });
      }

      // Show all results if multiple found
      if (fdaResult.allResults.length > 1) {
        console.log(`\n📋 Found ${fdaResult.allResults.length} total results. Showing first result above.`);
      }
      
    } else {
      console.log("\n❌ OpenFDA Results:");
      console.log("Error:", fdaResult.error);
    }
  }

  console.log("\n✨ Test completed!");
}

// Run the test
runTest().catch(console.error); 