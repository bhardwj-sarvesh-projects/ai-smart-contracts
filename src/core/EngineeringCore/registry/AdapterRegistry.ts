import { BlockchainRegistry } from '../adapters/blockchain/BlockchainRegistry';
import { LanguageRegistry } from '../adapters/language/LanguageRegistry';
import { FrameworkRegistry } from '../adapters/framework/FrameworkRegistry';
import { ProviderRegistry } from '../adapters/provider/ProviderRegistry';

export class AdapterRegistry {
  static getBlockchain(id: string) {
    return BlockchainRegistry.getAdapter(id);
  }

  static getLanguage(id: string) {
    return LanguageRegistry.getAdapter(id);
  }

  static getFramework(id: string) {
    return FrameworkRegistry.getAdapter(id);
  }

  static getProvider(id: string) {
    return ProviderRegistry.getAdapter(id);
  }

  static listAllBlockchains() {
    return BlockchainRegistry.getAll();
  }
}
