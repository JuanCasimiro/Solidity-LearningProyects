# Solidity-FirstContact
Primer contacto con solidity y resumen de lo aprendido

Return Values
To return a value from a function, the declaration looks like this:

string greeting = "What's up dog";

function sayHello() public returns (string memory) {
  return greeting;
}
In Solidity, the function declaration contains the type of the return value (in this case string).

Function modifiers
The above function doesn't actually change state in Solidity — e.g. it doesn't change any values or write anything.

So in this case we could declare it as a view function, meaning it's only viewing the data but not modifying it:

function sayHello() public view returns (string memory) {
Solidity also contains pure functions, which means you're not even accessing any data in the app. Consider the following:

function _multiply(uint a, uint b) private pure returns (uint) {
  return a * b;
}
This function doesn't even read from the state of the app — its return value depends only on its function parameters. So in this case we would declare the function as pure.

Note: It may be hard to remember when to mark functions as pure/view. Luckily the Solidity compiler is good about issuing warnings to let you know when you should use one of these modifiers.


**msg.sender**
In Solidity, there are certain global variables that are available to all functions. One of these is msg.sender, which refers to the address of the person (or smart contract) who called the current function.

Let's recap:
We've added a way to update our CryptoKitties contracts
We've learned to protect core functions with onlyOwner
We've learned about gas and gas optimization
We added levels and cooldowns to our zombies
We now have functions to update a zombie's name and DNA once the zombie gets above a certain level
And finally, we now have a function to return a user's zombie army
