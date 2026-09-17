pragma circom 2.1.0;
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
template T(){signal input i[6]; signal output o; component p=Poseidon(6); for(var k=0;k<6;k++){p.inputs[k]<==i[k];} o<==p.out;} component main=T();
