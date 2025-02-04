// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

contract MiColeccionNFT is ERC721A, Ownable, IERC2981 {
    uint256 public constant MAX_SUPPLY = 50;
    uint256 public constant PRICE = 0.05 ether;
    uint256 public constant MAX_MINT_PER_TX = 5;

    mapping(uint256 => bool) public mintedTokens; // Controla qué NFTs ya se han minteado
    uint256[] private availableTokens; // Almacena IDs disponibles para mintRandom()

    address private _royaltyReceiver;
    uint96 private _royaltyFee = 1000; // 10% en base 10000 (1000 = 10%)

    // Constructor sin argumentos en el deploy; se hardcodean el nombre y el símbolo
    constructor() ERC721A("Mi Coleccion NFT", "MCNFT") Ownable(msg.sender){
        _royaltyReceiver = msg.sender;
        _initializeAvailableTokens();
    }

    // Inicializa la lista de IDs disponibles
    function _initializeAvailableTokens() private {
        for (uint256 i = 0; i < MAX_SUPPLY; i++) {
            availableTokens.push(i);
        }
    }

    // Mint manual: El usuario elige qué ID mintear
    function mintManual(uint256 tokenId) external payable {
        require(tokenId < MAX_SUPPLY, "ID fuera de rango");
        require(!mintedTokens[tokenId], "NFT ya minteado");
        require(msg.value >= PRICE, "ETH insuficiente");

        mintedTokens[tokenId] = true;
        _safeMint(msg.sender, 1);
    }

    // Mint aleatorio: Se asigna un ID aleatorio de la lista disponible
    function mintRandom() external payable {
        require(availableTokens.length > 0, "No quedan NFTs disponibles");
        require(msg.value >= PRICE, "ETH insuficiente");

        uint256 randomIndex = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender))) % availableTokens.length;
        uint256 tokenId = availableTokens[randomIndex];

        mintedTokens[tokenId] = true;
        availableTokens[randomIndex] = availableTokens[availableTokens.length - 1];
        availableTokens.pop();

        _safeMint(msg.sender, 1);
    }

    // Implementación de ERC-2981 (Royalties en OpenSea)
    function royaltyInfo(uint256, uint256 salePrice) external view override returns (address, uint256) {
        uint256 royaltyAmount = (salePrice * _royaltyFee) / 10000;
        return (_royaltyReceiver, royaltyAmount);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721A, IERC165) returns (bool) {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }

    // Permite modificar los royalties (soloOwner)
    function setRoyaltyInfo(address receiver, uint96 fee) external onlyOwner {
        require(fee <= 10000, "Fee demasiado alto");
        _royaltyReceiver = receiver;
        _royaltyFee = fee;
    }

    // Retira los fondos acumulados a la dirección del propietario
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No hay fondos para retirar");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Transferencia fallida");
    }
}
