import { isProductionEnv } from './security.js';
export function mockDevProvider(env={}){return{id:'mock-dev-identity-provider',name:'Mock Dev Identity Provider',mode:'mock',allowed:env.IDENTITY_PROVIDER_MODE==='mock'&&env.ALLOW_DEV_LOGIN==='true'&&!isProductionEnv(env)};}
export function manualReviewProvider(){return{id:'manual-review-provider',name:'Manual Review Provider',mode:'manual'};}
export function externalProviderSkeleton(env={}){return{id:'external-provider-skeleton',name:'External Provider Skeleton',mode:'external',configured:Boolean(env.IDENTITY_PROVIDER_API_KEY)};}
export function getIdentityProvider(env={}){if(env.IDENTITY_PROVIDER_MODE==='mock')return mockDevProvider(env);if(env.IDENTITY_PROVIDER_MODE==='external')return externalProviderSkeleton(env);return manualReviewProvider(env);}
