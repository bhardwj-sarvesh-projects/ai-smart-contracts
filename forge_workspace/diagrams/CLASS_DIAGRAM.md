# Contract Class & Hierarchy Diagram

**Project Name:** ERC20 Token Test Benchmark (Simple)

```mermaid
classDiagram
    class ERC20 Token Test Benchmark (Simple) {
        +address owner
        +bool paused
        +uint256 totalVolume
        +initialize()
        +executeOperation()
        +pause()
        +unpause()
    }

    class Context {
        +_msgSender()
        +_msgData()
    }

    class Ownable {
        +address owner
        +onlyOwner()
        +transferOwnership()
    }

    class ReentrancyGuard {
        -uint256 _status
        +nonReentrant()
    }

    Context <|-- Ownable
    Ownable <|-- ERC20 Token Test Benchmark (Simple)
    ReentrancyGuard <|-- ERC20 Token Test Benchmark (Simple)