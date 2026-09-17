pragma circom 2.1.0;
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
template T(){signal input i[2]; signal output o; component p=Poseidon(2); p.inputs[0]<==i[0]; p.inputs[1]<==i[1]; o<==p.out;} component main=T();
