pragma circom 2.1.0;
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
template T(){signal input a; signal input b; signal input c; signal input d; signal input e; signal input f; component v=EdDSAPoseidonVerifier(); v.enabled<==1; v.Ax<==a; v.Ay<==b; v.R8x<==c; v.R8y<==d; v.S<==e; v.M<==f;} component main=T();
