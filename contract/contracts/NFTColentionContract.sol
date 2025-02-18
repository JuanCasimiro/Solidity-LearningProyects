// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

contract MiColeccionNFT is ERC721A, Ownable, IERC2981 {
    uint256 public constant MAX_SUPPLY = 50;
    uint256 public price = 0.05 ether;
    uint256 public constant MAX_MINT_PER_TX = 5;
    string private baseURI;

    event NFTMinted(address indexed minter, uint256 indexed tokenId);

    mapping(uint256 => bool) public mintedTokens; // Controla qué NFTs ya se han minteado

    address private _royaltyReceiver;
    uint96 private _royaltyFee = 1000; // 10% en base 10000 (1000 = 10%)

    // Constructor sin argumentos en el deploy; se hardcodean el nombre y el símbolo
    constructor() ERC721A("Mi Coleccion NFT", "MCNFT") Ownable(msg.sender){
        _royaltyReceiver = msg.sender;

    }

    // Mint : El usuario elige qué ID mintear
    function mintManual(uint256 tokenId) external payable {
        require(tokenId < MAX_SUPPLY, "ID fuera de rango");
        require(!mintedTokens[tokenId], "NFT ya minteado");
        require(msg.value >= price, "ETH insuficiente");

        mintedTokens[tokenId] = true;
        _safeMint(msg.sender, 1);
        emit NFTMinted(msg.sender, tokenId);
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

    function setBaseURI(string memory _newBaseURI) external onlyOwner {
        baseURI = _newBaseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    // Función para devolver la URI de metadata del contrato
    function contractURI() public pure returns (string memory) {
        return "ipfs://QmEjemploCID/contract.json";
    }

    function setPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "El precio debe ser mayor que 0");
        price = newPrice;
    }
}
