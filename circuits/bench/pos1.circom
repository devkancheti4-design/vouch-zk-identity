pragma circom 2.1.0;
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
template T(){signal input i; signal output o; component p=Poseidon(1); p.inputs[0]<==i; o<==p.out;} component main=T();
