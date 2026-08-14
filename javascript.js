// Recipe app behavior
// -------------------
// This file contains the frontend behavior for the recipe website:
// the startup popup, the Add Recipe form flow, image handling,
// recipe creation, and the ingredient checklist progress display.

document.addEventListener("DOMContentLoaded", function () {

    // ============================================
    // RECIPE DELETE PASSWORD
    // This is a simple frontend-only password gate so only
    // someone who knows the password can remove a recipe.
    // Update this value later if you want a different password.
    // ============================================
    const RECIPE_DELETE_PASSWORD = "recipe123";

    // ============================================
    // FIREBASE CONNECTION
    // Exposes the Firebase app and database to the page so the
    // recipe app can later read and write data from Firestore.
    // ============================================
    window.firebaseApp = window.firebaseApp || (window.firebase && firebase.app());
    window.firebaseAnalytics = window.firebaseAnalytics || (window.firebase && firebase.analytics && firebase.analytics());
    window.firebaseDb = window.firebaseDb || (window.firebase && firebase.firestore && firebase.firestore());

    // ============================================
    // FIRESTORE HELPERS
    // Keeps the recipe page connected to Firebase while still
    // allowing the local UI to update immediately after a save.
    // ============================================
    const firestoreDb = window.firebaseDb;
    const firebaseStorageRef = window.firebaseStorage;

    async function uploadRecipeImageToStorage(file) {
        if (!file || !firebaseStorageRef) {
            return "";
        }

        const timestamp = Date.now();
        const fileName = `recipe-images/${timestamp}-${file.name.replace(/\s+/g, "-")}`;
        const storageRef = firebaseStorageRef.ref(fileName);
        const uploadResult = await storageRef.put(file);
        return await uploadResult.ref.getDownloadURL();
    }

    function normalizeRecipeForFirestore(recipe) {
        return {
            name: recipe.name,
            description: recipe.description,
            category: recipe.category,
            prepTime: recipe.prepTime,
            servings: recipe.servings,
            difficulty: recipe.difficulty,
            calories: Number(recipe.calories) || 0,
            protein: Number(recipe.protein) || 0,
            carbs: Number(recipe.carbs) || 0,
            fat: Number(recipe.fat) || 0,
            fiber: Number(recipe.fiber) || 0,
            image: recipe.image,
            ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
            instructions: Array.isArray(recipe.instructions) ? recipe.instructions : [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
    }

    async function saveRecipeToFirestore(recipe) {
        if (!firestoreDb) {
            return recipe;
        }

        const docRef = await firestoreDb.collection("recipes").add(normalizeRecipeForFirestore(recipe));
        return {
            ...recipe,
            firestoreId: docRef.id,
            id: docRef.id
        };
    }

    async function loadRecipesFromFirestore() {
        if (!firestoreDb) {
            return [];
        }

        const snapshot = await firestoreDb.collection("recipes").get();
        return snapshot.docs.map(function (doc) {
            const data = doc.data();
            return {
                id: doc.id,
                firestoreId: doc.id,
                name: data.name || "Untitled Recipe",
                description: data.description || "",
                category: data.category || "savory",
                prepTime: data.prepTime || "",
                servings: data.servings || "",
                difficulty: data.difficulty || "Easy",
                calories: Number(data.calories) || 0,
                protein: Number(data.protein) || 0,
                carbs: Number(data.carbs) || 0,
                fat: Number(data.fat) || 0,
                fiber: Number(data.fiber) || 0,
                image: data.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
                ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
                instructions: Array.isArray(data.instructions) ? data.instructions : []
            };
        });
    }

    async function deleteRecipeFromFirestore(recipeId) {
        if (!firestoreDb || !recipeId) {
            return false;
        }

        await firestoreDb.collection("recipes").doc(String(recipeId)).delete();
        return true;
    }

    // ============================================
    // STARTUP POPUP
    // Handles the retro welcome popup and its
    // yes/no choices without altering the page layout.
    // ============================================
    const popup = document.getElementById("muscle-popup");
    const yesButton = document.getElementById("muscle-yes");
    const noButton = document.getElementById("muscle-no");

    if (yesButton && popup) {
        yesButton.addEventListener("click", function () {
            popup.style.display = "none";
        });
    }

    if (noButton) {
        noButton.addEventListener("click", function () {
            window.close();

            setTimeout(function () {
                document.body.innerHTML = "";
                document.body.style.background = "#000";
            }, 100);
        });
    }

    // ============================================
    // ADD RECIPE MODAL
    // Opens a small in-page form so the user can create a recipe
    // without editing the files manually in the editor.
    // ============================================
    const addRecipeButton = document.getElementById("add-recipe-button");
    const addRecipeModal = document.getElementById("add-recipe-modal");
    const closeRecipeButton = document.getElementById("close-recipe-button");
    const cancelRecipeButton = document.getElementById("cancel-recipe-button");
    const addRecipeForm = document.getElementById("add-recipe-form");
    const addRecipeError = document.getElementById("add-recipe-error");

    function openRecipeModal() {
        if (!addRecipeModal) return;
        addRecipeModal.classList.remove("hidden");
        addRecipeModal.setAttribute("aria-hidden", "false");
    }

    function closeRecipeModal() {
        if (!addRecipeModal) return;
        addRecipeModal.classList.add("hidden");
        addRecipeModal.setAttribute("aria-hidden", "true");
    }

    if (addRecipeButton) {
        addRecipeButton.addEventListener("click", openRecipeModal);
    }

    if (closeRecipeButton) {
        closeRecipeButton.addEventListener("click", closeRecipeModal);
    }

    if (cancelRecipeButton) {
        cancelRecipeButton.addEventListener("click", closeRecipeModal);
    }

    if (addRecipeModal) {
        addRecipeModal.addEventListener("click", function (event) {
            if (event.target === addRecipeModal) {
                closeRecipeModal();
            }
        });
    }

    // ============================================
    // IMAGE UPLOAD & COMPRESSION
    // Allows the user to choose a local file or paste a URL.
    // Uploaded images are compressed to keep them reasonably sized.
    // ============================================
    const imageUploadInput = document.getElementById("recipe-image-upload");
    const imageUrlInput = document.getElementById("recipe-image-url");
    const imagePreview = document.getElementById("recipe-image-preview");
    let uploadedImageDataUrl = "";

    function showPreviewImage(source) {
        if (!imagePreview) return;

        imagePreview.src = source;
        imagePreview.classList.remove("hidden");
    }

    function clearPreviewImage() {
        if (!imagePreview) return;
        imagePreview.src = "";
        imagePreview.classList.add("hidden");
    }

    function readFileAsDataUrl(file) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();

            reader.onload = function () {
                resolve(reader.result);
            };

            reader.onerror = function () {
                reject(new Error("Unable to read the selected image."));
            };

            reader.readAsDataURL(file);
        });
    }

    function compressImageDataUrl(dataUrl, maxWidth, maxHeight, quality) {
        return new Promise(function (resolve, reject) {
            const image = new Image();

            image.onload = function () {
                const canvas = document.createElement("canvas");
                let targetWidth = image.width;
                let targetHeight = image.height;

                if (targetWidth > maxWidth || targetHeight > maxHeight) {
                    const scale = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
                    targetWidth = Math.round(targetWidth * scale);
                    targetHeight = Math.round(targetHeight * scale);
                }

                canvas.width = targetWidth;
                canvas.height = targetHeight;

                const context = canvas.getContext("2d");
                context.drawImage(image, 0, 0, targetWidth, targetHeight);

                resolve(canvas.toDataURL("image/jpeg", quality));
            };

            image.onerror = function () {
                reject(new Error("The selected image could not be processed."));
            };

            image.src = dataUrl;
        });
    }

    if (imageUploadInput) {
        imageUploadInput.addEventListener("change", async function () {
            const file = imageUploadInput.files[0];

            if (!file) return;

            if (!file.type.startsWith("image/")) {
                setAddRecipeError("Please choose a valid image file.");
                return;
            }

            try {
                const originalDataUrl = await readFileAsDataUrl(file);
                const compressedDataUrl = await compressImageDataUrl(originalDataUrl, 1200, 1200, 0.8);

                uploadedImageDataUrl = compressedDataUrl;
                imageUrlInput.value = "";
                showPreviewImage(compressedDataUrl);
                clearAddRecipeError();
            } catch (error) {
                setAddRecipeError(error.message || "The image could not be processed.");
            }
        });
    }

    if (imageUrlInput) {
        imageUrlInput.addEventListener("input", function () {
            const url = imageUrlInput.value.trim();

            if (!url) {
                if (!uploadedImageDataUrl) {
                    clearPreviewImage();
                }
                return;
            }

            uploadedImageDataUrl = "";
            showPreviewImage(url);
            clearAddRecipeError();
        });
    }

    function getSelectedRecipeImage() {
        if (uploadedImageDataUrl) {
            return uploadedImageDataUrl;
        }

        const url = imageUrlInput ? imageUrlInput.value.trim() : "";
        return url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80";
    }

    // ============================================
    // DYNAMIC INGREDIENTS AND INSTRUCTIONS
    // Lets the user add, edit and remove rows before saving.
    // ============================================
    const ingredientList = document.getElementById("ingredient-list");
    const instructionList = document.getElementById("instruction-list");
    const addIngredientButton = document.getElementById("add-ingredient-button");
    const addInstructionButton = document.getElementById("add-instruction-button");

    function createListRow(value, placeholder, textarea) {
        const row = document.createElement("li");
        row.className = "dynamic-list-item";

        const field = textarea ? document.createElement("textarea") : document.createElement("input");
        field.value = value;
        field.placeholder = placeholder;

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-list-item";
        removeButton.textContent = "Remove";

        removeButton.addEventListener("click", function () {
            row.remove();
        });

        row.appendChild(field);
        row.appendChild(removeButton);
        return row;
    }

    function addIngredientRow(value) {
        if (!ingredientList) return;
        ingredientList.appendChild(createListRow(value || "", "e.g. 2 cups spinach", false));
    }

    function addInstructionRow(value) {
        if (!instructionList) return;
        instructionList.appendChild(createListRow(value || "", "e.g. Heat the pan and add the ingredients", true));
    }

    if (addIngredientButton) {
        addIngredientButton.addEventListener("click", function () {
            addIngredientRow("");
        });
    }

    if (addInstructionButton) {
        addInstructionButton.addEventListener("click", function () {
            addInstructionRow("");
        });
    }

    // Start with a few blank rows so the form is ready to use.
    if (ingredientList) {
        addIngredientRow("");
        addIngredientRow("");
    }

    if (instructionList) {
        addInstructionRow("");
        addInstructionRow("");
    }

    function setAddRecipeError(message) {
        if (!addRecipeError) return;
        addRecipeError.textContent = message;
    }

    function clearAddRecipeError() {
        if (!addRecipeError) return;
        addRecipeError.textContent = "";
    }

    function getListValues(listContainer, type) {
        if (!listContainer) return [];

        const rows = listContainer.querySelectorAll(".dynamic-list-item");
        const values = [];

        rows.forEach(function (row) {
            const field = row.querySelector("input, textarea");
            if (!field) return;

            const value = field.value.trim();
            if (value) {
                values.push(type === "instruction" ? value : value);
            }
        });

        return values;
    }

    // ============================================
    // RECIPE FILTERS AND SEARCH
    // Updates the cards in place based on the current category,
    // calorie range, and name search input. This keeps the same
    // layout while showing only the recipes that match.
    // ============================================
    const searchInput = document.getElementById("recipe-search");
    const searchButton = document.querySelector(".search-row .retro-button");
    const filterButtons = document.querySelectorAll(".filter-button");
    const calorieFilter = document.getElementById("calorie-filter");
    const HIGH_PROTEIN_MINIMUM = 30;

    function getRecipeCardData(card) {
        if (!card) return null;

        const titleElement = card.querySelector("h3");
        const title = titleElement ? titleElement.textContent.trim() : "";

        const caloriesElement = card.querySelector(".nutrition-calories strong");
        const calories = caloriesElement ? Number.parseFloat(caloriesElement.textContent) || 0 : 0;

        const nutritionRows = card.querySelectorAll(".nutrition-row");
        let protein = 0;

        nutritionRows.forEach(function (row) {
            const label = row.querySelector("span");
            const value = row.querySelector("strong");

            if (!label || !value) return;

            if (label.textContent.trim().toLowerCase() === "protein") {
                protein = Number.parseFloat(value.textContent) || 0;
            }
        });

        return {
            title: title,
            calories: calories,
            protein: protein,
            category: card.closest(".recipe-section") ? card.closest(".recipe-section").id : ""
        };
    }

    function updateSectionRecipeCount(section) {
        if (!section) return;

        const countElement = section.querySelector(".recipe-count");
        if (!countElement) return;

        const visibleCards = Array.from(section.querySelectorAll(".recipe-card")).filter(function (card) {
            return card.style.display !== "none";
        }).length;

        countElement.textContent = `${String(visibleCards).padStart(2, "0")} ${visibleCards === 1 ? "recipe" : "recipes"}`;
    }

    function syncFilterButtonState(activeCategory) {
        filterButtons.forEach(function (button) {
            const isActive = button.dataset.filterCategory === activeCategory;
            button.classList.toggle("active", isActive);
        });
    }

    function getCurrentFilters() {
        const activeCategoryButton = document.querySelector(".filter-button.active");
        const category = activeCategoryButton ? activeCategoryButton.dataset.filterCategory || "all" : "all";
        const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : "";
        const calorieLimit = calorieFilter ? Number(calorieFilter.value) || null : null;

        return {
            category: category,
            searchValue: searchValue,
            calorieLimit: calorieLimit
        };
    }

    function matchesCategoryFilter(card, category) {
        if (category === "all") return true;

        if (category === "high-protein") {
            const cardData = getRecipeCardData(card);
            return cardData ? cardData.protein >= HIGH_PROTEIN_MINIMUM : false;
        }

        return card.closest(".recipe-section") && card.closest(".recipe-section").id === category;
    }

    function matchesCalorieFilter(card, calorieLimit) {
        if (!calorieLimit) return true;

        const cardData = getRecipeCardData(card);
        if (!cardData) return false;

        return cardData.calories < calorieLimit;
    }

    function matchesSearchFilter(card, searchValue) {
        if (!searchValue) return true;

        const cardData = getRecipeCardData(card);
        if (!cardData) return false;

        return cardData.title.toLowerCase().includes(searchValue);
    }

    function applyRecipeFilters() {
        const filterState = getCurrentFilters();
        const recipeSections = document.querySelectorAll(".recipe-section");

        document.querySelectorAll(".recipe-card").forEach(function (card) {
            const matchesCategory = matchesCategoryFilter(card, filterState.category);
            const matchesCalories = matchesCalorieFilter(card, filterState.calorieLimit);
            const matchesSearch = matchesSearchFilter(card, filterState.searchValue);
            const shouldShow = matchesCategory && matchesCalories && matchesSearch;

            card.style.display = shouldShow ? "" : "none";
        });

        recipeSections.forEach(function (section) {
            updateSectionRecipeCount(section);
        });
    }

    if (filterButtons.length) {
        filterButtons.forEach(function (button) {
            button.addEventListener("click", function () {
                const selectedCategory = button.dataset.filterCategory || "all";
                syncFilterButtonState(selectedCategory);
                applyRecipeFilters();
            });
        });
    }

    if (searchInput) {
        searchInput.addEventListener("input", applyRecipeFilters);
    }

    if (searchButton) {
        searchButton.addEventListener("click", function (event) {
            event.preventDefault();
            applyRecipeFilters();
        });
    }

    if (calorieFilter) {
        calorieFilter.addEventListener("change", applyRecipeFilters);
    }

    // Run the filters immediately on page load so the cards match the
    // current UI state and stay in sync with any newly added recipe.
    applyRecipeFilters();

    function updateRecipeCount(sectionId) {
        const section = document.getElementById(sectionId);
        if (!section) return;

        const countElement = section.querySelector(".recipe-count");
        if (!countElement) return;

        const grid = section.querySelector(".recipe-grid");
        if (!grid) return;

        const totalRecipes = grid.querySelectorAll(".recipe-card").length;
        countElement.textContent = `${String(totalRecipes).padStart(2, "0")} recipes`;
    }

    // ============================================
    // RECIPE DELETE ACTION
    // Adds a delete button to every recipe card and protects
    // deletion behind a simple password prompt.
    // ============================================
    function attachDeleteButton(card) {
        const cardBody = card.querySelector(".recipe-card-body");
        if (!cardBody) return;

        const existingDeleteButton = card.querySelector(".recipe-delete-button");
        if (existingDeleteButton) return;

        const deleteWrapper = document.createElement("div");
        deleteWrapper.className = "recipe-delete-wrapper";

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "recipe-delete-button";
        deleteButton.textContent = "🗑 Delete Recipe";

        deleteButton.addEventListener("click", async function () {
            const enteredPassword = window.prompt("Enter the password to delete this recipe:");

            if (enteredPassword === null) {
                return;
            }

            if (enteredPassword !== RECIPE_DELETE_PASSWORD) {
                window.alert("Incorrect password. Recipe was not deleted.");
                return;
            }

            const shouldDelete = window.confirm("Are you sure you want to delete this recipe?");
            if (!shouldDelete) return;

            const recipeId = card.dataset.firestoreId || card.dataset.recipeId || "";
            const parentSection = card.closest(".recipe-section");

            try {
                if (recipeId) {
                    await deleteRecipeFromFirestore(recipeId);
                }
            } catch (error) {
                console.error("Failed to delete recipe from Firestore:", error);
            }

            card.remove();

            if (parentSection) {
                updateRecipeCount(parentSection.id);
                applyRecipeFilters();
            }
        });

        deleteWrapper.appendChild(deleteButton);

        const meta = cardBody.querySelector(".recipe-meta");
        if (meta) {
            meta.insertAdjacentElement("afterend", deleteWrapper);
        } else {
            cardBody.appendChild(deleteWrapper);
        }
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getCategoryLabel(categoryValue) {
        const categoryMap = {
            savory: "🥗 SAVORY",
            sweet: "🍰 SWEET",
            "high-protein": "💪 HIGH PROTEIN"
        };

        return categoryMap[categoryValue] || "🥗 SAVORY";
    }

    function getCategoryClass(categoryValue) {
        if (categoryValue === "sweet") return "sweet";
        if (categoryValue === "high-protein") return "high-protein";
        return "";
    }

    function renderIngredientChecklist(card, ingredients) {
        const existingChecklist = card.querySelector(".recipe-ingredient-progress");
        if (existingChecklist) {
            existingChecklist.remove();
        }

        if (!ingredients || ingredients.length === 0) return;

        const ingredientProgress = document.createElement("div");
        ingredientProgress.className = "recipe-ingredient-progress";

        const checklist = document.createElement("div");
        checklist.className = "ingredient-checklist";

        ingredients.forEach(function (ingredient) {
            const label = document.createElement("label");
            label.className = "ingredient-item";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.setAttribute("aria-label", ingredient);

            const labelText = document.createElement("span");
            labelText.textContent = ingredient;

            checkbox.addEventListener("change", function () {
                const ingredientBoxes = card.querySelectorAll(".ingredient-item input");
                const checkedCount = Array.from(ingredientBoxes).filter(function (box) {
                    return box.checked;
                }).length;

                const progressFill = card.querySelector(".ingredient-progress-fill");
                const progressText = card.querySelector(".ingredient-progress-text");

                if (!progressFill || !progressText) return;

                const percentage = Math.round((checkedCount / ingredientBoxes.length) * 100);
                progressFill.style.width = `${percentage}%`;

                const summary = `${checkedCount} / ${ingredientBoxes.length} ingredients — ${percentage}%`;

                if (checkedCount === ingredientBoxes.length) {
                    progressText.textContent = "You have everything you need! 🎉";
                } else {
                    progressText.textContent = summary;
                }
            });

            label.appendChild(checkbox);
            label.appendChild(labelText);
            checklist.appendChild(label);
        });

        const progressTrack = document.createElement("div");
        progressTrack.className = "ingredient-progress-track";

        const progressFill = document.createElement("span");
        progressFill.className = "ingredient-progress-fill";
        progressFill.style.width = "0%";

        progressTrack.appendChild(progressFill);

        const progressText = document.createElement("div");
        progressText.className = "ingredient-progress-text";
        progressText.textContent = `0 / ${ingredients.length} ingredients — 0%`;

        ingredientProgress.appendChild(checklist);
        ingredientProgress.appendChild(progressTrack);
        ingredientProgress.appendChild(progressText);

        card.appendChild(ingredientProgress);
    }

    function renderRecipeCard(recipe) {
        const targetSection = document.getElementById(recipe.category);
        if (!targetSection) return;

        const grid = targetSection.querySelector(".recipe-grid");
        if (!grid) return;

        const existingCards = grid.querySelectorAll(".recipe-card");
        const duplicateId = recipe.firestoreId || recipe.id;

        if (duplicateId) {
            const alreadyExists = Array.from(existingCards).some(function (card) {
                return card.dataset.firestoreId === String(duplicateId);
            });

            if (alreadyExists) return;
        }

        const recipeCard = document.createElement("article");
        recipeCard.className = "recipe-card";
        recipeCard.dataset.firestoreId = recipe.firestoreId || recipe.id || "";

        const categoryClass = getCategoryClass(recipe.category);
        const categoryName = getCategoryLabel(recipe.category);
        const ingredientMarkup = recipe.ingredients
            .map(function (ingredient) {
                return `<li>${escapeHtml(ingredient)}</li>`;
            })
            .join("");

        const instructionMarkup = recipe.instructions
            .map(function (step, index) {
                return `<li>${escapeHtml(step)}</li>`;
            })
            .join("");

        recipeCard.innerHTML = `
            <div class="recipe-image">
                <img src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.name)}" />
                <span class="recipe-category ${categoryClass}">${categoryName}</span>
            </div>

            <div class="recipe-card-body">
                <h3>${escapeHtml(recipe.name)}</h3>
                <p class="recipe-description">${escapeHtml(recipe.description)}</p>

                <div class="recipe-meta">
                    <span>⏱ ${escapeHtml(recipe.prepTime)}</span>
                    <span>👥 ${escapeHtml(recipe.servings)} servings</span>
                    <span>⭐ ${escapeHtml(recipe.difficulty)}</span>
                </div>

                <div class="nutrition-label ${categoryClass === "sweet" ? "sweet-label" : ""}">
                    <div class="nutrition-header">NUTRITION FACTS</div>
                    <div class="nutrition-serving">Per serving</div>
                    <div class="nutrition-calories">
                        <span>Calories</span>
                        <strong>${escapeHtml(recipe.calories)}</strong>
                        <small>kcal</small>
                    </div>
                    <div class="nutrition-divider"></div>
                    <div class="nutrition-row"><span>Protein</span><strong>${escapeHtml(recipe.protein)}g</strong></div>
                    <div class="nutrition-row"><span>Carbohydrates</span><strong>${escapeHtml(recipe.carbs)}g</strong></div>
                    <div class="nutrition-row"><span>Fat</span><strong>${escapeHtml(recipe.fat)}g</strong></div>
                    <div class="nutrition-row"><span>Fiber</span><strong>${escapeHtml(recipe.fiber)}g</strong></div>
                </div>

                <details class="recipe-details" open>
                    <summary>🧾 Ingredients</summary>
                    <ul>${ingredientMarkup}</ul>
                </details>

                <details class="recipe-details">
                    <summary>📋 Instructions</summary>
                    <ol>${instructionMarkup}</ol>
                </details>
            </div>
        `;

        grid.appendChild(recipeCard);
        attachDeleteButton(recipeCard);
        renderIngredientChecklist(recipeCard, recipe.ingredients);
        updateRecipeCount(recipe.category);
        applyRecipeFilters();
    }

    function validateRecipeForm(formData) {
        const requiredFields = [
            { name: "recipe-name", label: "Recipe name" },
            { name: "recipe-description", label: "Description" },
            { name: "recipe-category", label: "Category" },
            { name: "recipe-prep-time", label: "Preparation time" },
            { name: "recipe-servings", label: "Servings" },
            { name: "recipe-difficulty", label: "Difficulty" },
            { name: "recipe-calories", label: "Calories" },
            { name: "recipe-protein", label: "Protein" },
            { name: "recipe-carbs", label: "Carbohydrates" },
            { name: "recipe-fat", label: "Fat" },
            { name: "recipe-fiber", label: "Fiber" }
        ];

        for (const field of requiredFields) {
            const value = formData.get(field.name);
            if (!value || String(value).trim() === "") {
                return `${field.label} is required.`;
            }
        }

        const ingredients = getListValues(ingredientList, "ingredient");
        const instructions = getListValues(instructionList, "instruction");

        if (ingredients.length === 0) {
            return "Please add at least one ingredient.";
        }

        if (instructions.length === 0) {
            return "Please add at least one instruction step.";
        }

        return "";
    }

    if (addRecipeForm) {
        addRecipeForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            clearAddRecipeError();

            const formData = new FormData(addRecipeForm);
            const validationMessage = validateRecipeForm(formData);

            if (validationMessage) {
                setAddRecipeError(validationMessage);
                return;
            }

            const recipeName = document.getElementById("recipe-name").value.trim();
            const recipeDescription = document.getElementById("recipe-description").value.trim();
            const category = document.getElementById("recipe-category").value;
            const prepTime = document.getElementById("recipe-prep-time").value.trim();
            const servings = document.getElementById("recipe-servings").value.trim();
            const difficulty = document.getElementById("recipe-difficulty").value;
            const calories = Number(document.getElementById("recipe-calories").value);
            const protein = Number(document.getElementById("recipe-protein").value);
            const carbs = Number(document.getElementById("recipe-carbs").value);
            const fat = Number(document.getElementById("recipe-fat").value);
            const fiber = Number(document.getElementById("recipe-fiber").value);
            const ingredients = getListValues(ingredientList, "ingredient");
            const instructions = getListValues(instructionList, "instruction");
            const selectedImage = getSelectedRecipeImage();
            let finalImageUrl = selectedImage;

            if (imageUploadInput && imageUploadInput.files && imageUploadInput.files[0]) {
                try {
                    finalImageUrl = await uploadRecipeImageToStorage(imageUploadInput.files[0]);
                } catch (error) {
                    console.error("Image upload failed:", error);
                }
            }

            const newRecipe = {
                id: Date.now(),
                name: recipeName,
                description: recipeDescription,
                category: category,
                prepTime: prepTime,
                servings: servings,
                difficulty: difficulty,
                calories: calories,
                protein: protein,
                carbs: carbs,
                fat: fat,
                fiber: fiber,
                image: finalImageUrl,
                ingredients: ingredients,
                instructions: instructions
            };

            try {
                const savedRecipe = await saveRecipeToFirestore(newRecipe);
                renderRecipeCard(savedRecipe);
            } catch (error) {
                renderRecipeCard(newRecipe);
                console.error("Failed to save recipe to Firestore:", error);
            }

            addRecipeForm.reset();
            uploadedImageDataUrl = "";
            clearPreviewImage();
            ingredientList.innerHTML = "";
            instructionList.innerHTML = "";
            addIngredientRow("");
            addIngredientRow("");
            addInstructionRow("");
            addInstructionRow("");
            closeRecipeModal();
        });
    }

    // ============================================
    // EXISTING RECIPE CHECKLISTS
    // Adds interactive ingredient checkboxes to the recipe cards
    // already on the page so the user can track what they have.
    // ============================================
    function enhanceExistingRecipeCards() {
        const cards = document.querySelectorAll(".recipe-card");

        cards.forEach(function (card) {
            attachDeleteButton(card);

            const ingredientDetails = Array.from(card.querySelectorAll("details")).find(function (details) {
                return /ingredients/i.test(details.textContent || "");
            });

            if (!ingredientDetails) return;

            const ingredientListItems = ingredientDetails.querySelectorAll("li");
            if (!ingredientListItems.length) return;

            const ingredientNames = Array.from(ingredientListItems).map(function (item) {
                return item.textContent.trim();
            }).filter(Boolean);

            renderIngredientChecklist(card, ingredientNames);
        });
    }

    enhanceExistingRecipeCards();
    applyRecipeFilters();

    async function initializeFirestoreRecipes() {
        const savedRecipes = await loadRecipesFromFirestore();

        savedRecipes.forEach(function (recipe) {
            renderRecipeCard(recipe);
        });

        applyRecipeFilters();
    }

    initializeFirestoreRecipes();

});