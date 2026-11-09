
let products = [];
let cart = {};
let orders = [];

// Connect Java backend
async function api(url, data = null) {
    const options = {};

    if (data) {
        options.method = "POST";
        options.headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        };
        options.body = new URLSearchParams(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || "Something went wrong");
    }

    return result;
}

// Product icons
function getIcon(name) {
    const icons = {
        Apple: "🍎",
        Banana: "🍌",
        Tomato: "🍅",
        Potato: "🥔",
        Milk: "🥛",
        Bread: "🍞",
        Rice: "🍚",
        Eggs: "🥚"
    };

    return icons[name] || "🛒";
}

// Load products from Java
async function loadProducts() {
    products = await api("/api/products");
    renderProducts();
    updateRestockOptions();
    renderCart();
}

// Display grocery products
function renderProducts() {
    const search = document.getElementById("search")
        .value.toLowerCase();

    const category = document.getElementById("category").value;
    const availability = document.getElementById("availability").value;

    const filtered = products.filter(p => {
        const matchName = p.name.toLowerCase().includes(search);
        const matchCategory =
            category === "All" || p.category === category;

        const matchAvailability =
            availability === "All" ||
            (availability === "Available" && p.stock > 0) ||
            (availability === "Out" && p.stock === 0);

        return matchName && matchCategory && matchAvailability;
    });

    const container = document.getElementById("productList");

    if (filtered.length === 0) {
        container.innerHTML = "<p>No products found.</p>";
        return;
    }

    container.innerHTML = filtered.map(p => `
        <div class="product-card">
            <div class="product-icon">${getIcon(p.name)}</div>

            <h3>${p.name}</h3>
            <p>Category: ${p.category}</p>
            <p><b>Price: ₹${Number(p.price).toFixed(2)}</b></p>

            <p class="${p.stock > 0 ? 'stock' : 'out-stock'}">
                ${p.stock > 0
                    ? 'Available: ' + p.stock
                    : 'Out of Stock'}
            </p>

            <button onclick="addToCart(${p.id})"
                ${p.stock === 0 ? "disabled" : ""}>
                Add to Cart
            </button>
        </div>
    `).join("");
}

// Add product to cart
function addToCart(id) {
    const product = products.find(p => p.id === id);

    if (!product || product.stock <= 0) return;

    if ((cart[id] || 0) >= product.stock) {
        alert("Maximum available stock reached!");
        return;
    }

    cart[id] = (cart[id] || 0) + 1;

    renderCart();
}

// Change cart quantity
function changeQuantity(id, change) {
    const product = products.find(p => p.id === id);

    const newQuantity = (cart[id] || 0) + change;

    if (newQuantity <= 0) {
        delete cart[id];
    } else if (product && newQuantity <= product.stock) {
        cart[id] = newQuantity;
    } else {
        alert("Available stock limit reached!");
    }

    renderCart();
}

// Display shopping cart and total
function renderCart() {
    const container = document.getElementById("cartItems");

    let total = 0;

    if (Object.keys(cart).length === 0) {
        container.innerHTML = "Your cart is empty.";
        document.getElementById("cartTotal").innerText =
            "Total: ₹0.00";
        return;
    }

    container.innerHTML = Object.entries(cart).map(
        ([id, quantity]) => {

            const p = products.find(x => x.id === Number(id));

            if (!p) return "";

            const amount = p.price * quantity;
            total += amount;

            return `
                <div>
                    <b>${p.name}</b>
                    - ₹${p.price} × ${quantity}
                    = ₹${amount.toFixed(2)}

                    <button data-id="${id}" data-change="-1">−</button>
                    <button data-id="${id}" data-change="1">+</button>
                </div>
            `;
        }
    ).join("");

    document.getElementById("cartTotal").innerText =
        "Total: ₹" + total.toFixed(2);
}

// Cart quantity buttons
document.getElementById("cartItems").addEventListener(
    "click", event => {

        const button = event.target.closest("button[data-id]");

        if (!button) return;

        changeQuantity(
            Number(button.dataset.id),
            Number(button.dataset.change)
        );
    }
);

// Place customer order
document.getElementById("placeOrder").addEventListener(
    "click", async () => {

        if (Object.keys(cart).length === 0) {
            alert("Please add products to your cart!");
            return;
        }

        try {
            const oldCart = { ...cart };
            const oldProducts = [...products];

            const items = Object.entries(cart)
                .map(([id, quantity]) => `${id}:${quantity}`)
                .join(",");

            const result = await api("/api/orders", { items });

            let bill = "FRESHBASKET - CUSTOMER BILL\n";
            bill += "Order ID: " + result.orderId + "\n";
            bill += "------------------------------\n";

            let total = 0;

            for (const [id, quantity] of Object.entries(oldCart)) {
                const p = oldProducts.find(
                    x => x.id === Number(id)
                );

                const amount = p.price * quantity;
                total += amount;

                bill += `${p.name} x ${quantity} = ₹${amount.toFixed(2)}\n`;
            }

            bill += "------------------------------\n";
            bill += "TOTAL: ₹" + total.toFixed(2) + "\n";
            bill += "Status: PLACED\n";
            bill += "Thank you for shopping!";

            document.getElementById("bill").innerText = bill;

            cart = {};

            await loadProducts();
            await loadOrders();

            alert("Order placed successfully!");

        } catch (error) {
            alert(error.message);
            await loadProducts();
        }
    }
);

// Load order history
async function loadOrders() {
    orders = await api("/api/orders");
    renderOrders();
}

// Display all orders
function renderOrders() {
    const container = document.getElementById("orderList");

    if (orders.length === 0) {
        container.innerHTML = "<p>No orders placed yet.</p>";
        return;
    }

    container.innerHTML = orders.map(o => `
        <div class="order-card">
            <h3>Order #${o.id}</h3>

            <p>
                ${o.items.map(i =>
                    `${i.name} x ${i.quantity}`
                ).join(", ")}
            </p>

            <p><b>Total: ₹${Number(o.total).toFixed(2)}</b></p>

            <p>Status: <b>${o.status}</b></p>

            ${o.status === "PLACED" ?
                `<button onclick="cancelOrder(${o.id})">
                    Cancel Order
                </button>` : ""}
        </div>
    `).join("");
}

// Cancel order
async function cancelOrder(id) {
    if (!confirm("Are you sure you want to cancel this order?")) {
        return;
    }

    try {
        const result = await api("/api/cancel", { id });

        alert(result.message);

        await loadProducts();
        await loadOrders();

    } catch (error) {
        alert(error.message);
    }
}

// Add new grocery product
document.getElementById("productForm").addEventListener(
    "submit", async event => {

        event.preventDefault();

        const form = event.target;
        const data = Object.fromEntries(new FormData(form));

        try {
            await api("/api/products", data);

            alert("New product added successfully!");

            form.reset();

            await loadProducts();

        } catch (error) {
            alert(error.message);
        }
    }
);

// Update available stock
document.getElementById("restockForm").addEventListener(
    "submit", async event => {

        event.preventDefault();

        const form = event.target;
        const data = Object.fromEntries(new FormData(form));

        try {
            await api("/api/restock", data);

            alert("Stock updated successfully!");

            form.reset();

            await loadProducts();

        } catch (error) {
            alert(error.message);
        }
    }
);

// Fill product selection for restocking
function updateRestockOptions() {
    const select = document.getElementById("restockProduct");

    select.innerHTML = products.map(p => `
        <option value="${p.id}">
            ${p.name} (Stock: ${p.stock})
        </option>
    `).join("");
}

// Search and filter events
document.getElementById("search").addEventListener(
    "input", renderProducts
);

document.getElementById("category").addEventListener(
    "change", renderProducts
);

document.getElementById("availability").addEventListener(
    "change", renderProducts
);

// Start application
async function startApplication() {
    try {
        await loadProducts();
        await loadOrders();

        console.log("FreshBasket connected to Java backend!");

    } catch (error) {
        alert("Cannot connect to Java server. Please start GroceryServer.java.");
    }
}

startApplication();
