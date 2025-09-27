/*
Simple test to check Pumpfun package structure
*/
import { fetchSubstream, createRegistry } from "@substreams/core";
import dotenv from "dotenv";

dotenv.config();

const SPKG = "https://spkg.io/0xpapercut/pumpfun-events-v0.1.7.spkg";

const testPackage = async () => {
  try {
    console.log("Testing Pumpfun package fetch...");
    console.log("Package URL:", SPKG);
    
    const pkg = await fetchSubstream(SPKG);
    console.log("✅ Package fetched successfully");
    
    // Log package structure
    console.log("\n📦 Package Info:");
    console.log("Package Name:", pkg.packageMeta?.name);
    console.log("Package Version:", pkg.packageMeta?.version);
    console.log("Package URL:", pkg.packageMeta?.url);
    
    // Log available modules
    console.log("\n🔧 Available Modules:");
    if (pkg.modules && pkg.modules.modules) {
      pkg.modules.modules.forEach((module, index) => {
        console.log(`${index + 1}. ${module.name} (${module.kind})`);
        console.log(`   - Input: ${module.inputs?.map(i => i.input?.case).join(', ') || 'none'}`);
        console.log(`   - Output: ${module.output?.type || 'unknown'}`);
      });
    } else {
      console.log("No modules found");
    }
    
    // Create registry to test
    const registry = createRegistry(pkg);
    console.log("\n✅ Registry created successfully");
    
    console.log("\n🎯 Use 'pumpfun_events' as the MODULE name in the stream configuration");
    
  } catch (error) {
    console.error("❌ Error:", error);
    if (error.message.includes('404')) {
      console.log("\n💡 Suggestions:");
      console.log("1. Check if the package URL is correct");
      console.log("2. Verify the package version (v0.1.7)");
      console.log("3. Try alternative URLs:");
      console.log("   - https://spkg.io/pumpfun-events/v0.1.7");
      console.log("   - https://github.com/0xpapercut/solana-substreams/releases/download/v0.1.7/pumpfun-events-v0.1.7.spkg");
    }
    
    if (error.message.includes('auth')) {
      console.log("Check your SUBSTREAMS_API_TOKEN");
    }
  }
};

testPackage();