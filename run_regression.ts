import { RegressionPlatformAcceptanceTest } from './src/core/EngineeringCore/regression/RegressionPlatformAcceptanceTest';

async function main() {
  console.log('🚀 Launching Enterprise Reliability & Regression Platform Verification...');
  const testResult = await RegressionPlatformAcceptanceTest.runPlatformVerification();

  if (testResult.allPassed && testResult.isProductionReady) {
    console.log('✅ REGRESSION SUITE COMPLETED SUCCESSFULLY: PRODUCTION READY!');
    process.exit(0);
  } else {
    console.log(`⚠️ REGRESSION SUITE COMPLETED: STATUS = ${testResult.finalDecision}`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('❌ Fatal error running regression platform:', err);
  process.exit(1);
});
