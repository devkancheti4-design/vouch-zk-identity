pragma circom 2.1.0;
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
template T(){signal input a; signal input b; signal output o; component c=GreaterEqThan(128); c.in[0]<==a; c.in[1]<==b; o<==c.out;} component main=T();
