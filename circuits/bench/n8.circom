pragma circom 2.1.0;
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
template T(){signal input a; signal output o[8]; component c=Num2Bits(8); c.in<==a; for(var k=0;k<8;k++){o[k]<==c.out[k];}} component main=T();
