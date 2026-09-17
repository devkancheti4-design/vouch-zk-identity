// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract Groth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 20252623374928166940041238127331972378934400132462610428352129164283039860339;
    uint256 constant alphay  = 16600968396686416602087880194763279518353574804186607652991508182158274956679;
    uint256 constant betax1  = 20404805101673923062733314902528753052158755856060908811538868047001202136801;
    uint256 constant betax2  = 8329992802472087965645862862785911038907729693392060698371431842870583899228;
    uint256 constant betay1  = 15711734887986609511000599498198738383286120039950405312856543751433768650187;
    uint256 constant betay2  = 13751953806459405259517981393869787739526554228183040104991124007736005197646;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 7996675573466537177173405289937114398904328239048652272917824242767862228368;
    uint256 constant deltax2 = 8496703614537116997099631499542499669377165482552633620402741633582368540604;
    uint256 constant deltay1 = 4304066529482766445474864558370964038004268556271715404946833092961178934616;
    uint256 constant deltay2 = 21220631591776760562254056689693287190121450151220692990789360145543215631087;

    
    uint256 constant IC0x = 14628206200275601261527278155321600977015421471400973123719499206047106025975;
    uint256 constant IC0y = 12319279162315278549648850268256568265344449719369946907054940408976407125419;
    
    uint256 constant IC1x = 15450673532167062003149361240392678327618107014731508233324306679186035139558;
    uint256 constant IC1y = 3662170004639744302833337473191335021694595679250040248523982664366214870110;
    
    uint256 constant IC2x = 11407074497063928972123721971536547769707177761372669002551767029597095953732;
    uint256 constant IC2y = 7212815480958975425984293424274666308115074364350117405278141133552329557794;
    
    uint256 constant IC3x = 2538895758325882893404136121573705930369436089521216005487054335843170173685;
    uint256 constant IC3y = 513651447851253333543797646930877227206926482927955569330551541850247363443;
    
    uint256 constant IC4x = 21281542971762256655273488055381460538967967746353019353651897617464266897142;
    uint256 constant IC4y = 21584314850754367478525533109512444885478891304593878842844711769293030125139;
    
    uint256 constant IC5x = 14604110942255092084705982790089067964742538725445844406221429153968448564481;
    uint256 constant IC5y = 8351775168125058137267655586980917072215261959708108822372459141478448841089;
    
    uint256 constant IC6x = 8828538956140598272215428994473094101600851124489876077858814021249066615807;
    uint256 constant IC6y = 2731900777007101218423329008278612775924862408513659495549364225202495472985;
    
    uint256 constant IC7x = 17174752684095622849614219454349150102890311504949206339137199648388045928884;
    uint256 constant IC7y = 13743722878156959367309925921167022295412137663227618654276614450106436916259;
    
    uint256 constant IC8x = 5913400071506248868685937990450531122983539062573814657917285650017146330502;
    uint256 constant IC8y = 6457191850534308461454845172661632073190565644012283776691802093376999038788;
    
    uint256 constant IC9x = 235284795195143995151869479987490407354362698418849177647701695883980744349;
    uint256 constant IC9y = 17557145756023482267074021250431960706080580275289350850159181246177126393325;
    
    uint256 constant IC10x = 1154908625505708387659326589701336673476963245070544193762873323744833767799;
    uint256 constant IC10y = 13742452323857025669868906919354208368391602324393248286462874413025427883808;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[10] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
