import * as vscode from "vscode";

interface SplitTabGroup {
  name: string;
  uris: string[];
}

// Global variable to track the URIs of split tabs opened by the extension.
let splitTabUris: string[] = [];
/**
 * Key used in workspaceState for persisting the original order of
 * tabs that were in the main (active) group before a split.
 */
const INITIAL_ORDER_KEY = "initialTabOrder";

/**
 * Type guard to determine if a tab's input is a text document input.
 * Since TabInputText is an interface, we check that the input is an object and has a 'uri' property.
 */
function isTextTabInput(input: unknown): input is vscode.TabInputText {
  return typeof input === "object" && input !== null && "uri" in input;
}

export function activate(context: vscode.ExtensionContext) {
  // Helper: Safely gather only those tabs that have a non-empty string label.
  function getAllLabeledTabs(): vscode.Tab[] {
    const tabGroups = vscode.window.tabGroups.all || [];
    const allTabs: vscode.Tab[] = [];
    for (const group of tabGroups) {
      if (!group.tabs) continue;
      for (const t of group.tabs) {
        if (t && typeof t.label === "string" && t.label.trim() !== "") {
          allTabs.push(t);
        }
      }
    }
    return allTabs;
  }

  // COMMAND 1: Split Selected Tabs
  const splitSelectedTabsCmd = vscode.commands.registerCommand(
    "extension.splitSelectedTabs",
    async () => {
      try {
        // Capture the active tab's URI to avoid reopening it.
        const activeEditor = vscode.window.activeTextEditor;
        const activeTabUri = activeEditor?.document.uri.toString();

        const allTabs = getAllLabeledTabs();
        if (allTabs.length === 0) {
          vscode.window.showInformationMessage("No labeled tabs found.");
          return;
        }
        // Persist the current visual order of tabs in the active group so we can
        // restore it when the user later runs `closeSplitTabs`.
        const mainGroup = vscode.window.tabGroups.activeTabGroup;
        if (mainGroup) {
          const initialOrderUris = mainGroup.tabs
            .filter((tab) => isTextTabInput(tab.input))
            .map((tab) => (tab.input as vscode.TabInputText).uri.toString());
          await context.workspaceState.update(
            INITIAL_ORDER_KEY,
            initialOrderUris
          );
        }

        // Create QuickPickItems for all tabs with them pre-selected.
        const items: vscode.QuickPickItem[] = allTabs.map((tab) => ({
          label: tab.label,
          picked: true,
        }));

        // Show Quick Pick with all items pre-selected.
        const pickedItems = await vscode.window.showQuickPick(items, {
          canPickMany: true,
          placeHolder: "Select tabs to split into separate columns",
        });

        if (!pickedItems || pickedItems.length === 0) {
          vscode.window.showInformationMessage("No tabs selected.");
          return;
        }

        // Filter to the matching Tab objects based on the selected labels.
        const chosenTabs = allTabs.filter((tab) =>
          pickedItems.some((item) => item.label === tab.label)
        );
        if (chosenTabs.length === 0) {
          vscode.window.showInformationMessage("No matching tabs found.");
          return;
        }

        // Start splitting tabs into new columns.
        let currentColumn = activeEditor?.viewColumn || vscode.ViewColumn.One;

        for (const tab of chosenTabs) {
          if (isTextTabInput(tab.input)) {
            const textTabInput = tab.input;
            const docUri = textTabInput.uri;

            // Skip the active tab so it isn't opened twice.
            if (docUri.toString() === activeTabUri) {
              continue;
            }

            const doc = await vscode.workspace.openTextDocument(docUri);

            // Check for unsaved changes.
            if (doc.isDirty) {
              const choice = await vscode.window.showWarningMessage(
                `The file "${docUri.path}" has unsaved changes. Save before splitting?`,
                "Save",
                "Skip"
              );
              if (choice === "Save") {
                await doc.save();
              } else if (choice !== "Skip") {
                continue;
              }
            }

            // Move to the next column.
            currentColumn++;
            if (currentColumn > vscode.ViewColumn.Nine) {
              currentColumn = vscode.ViewColumn.Nine;
            }

            // Show the document in the new column.
            await vscode.window.showTextDocument(doc, {
              viewColumn: currentColumn,
              preserveFocus: true,
              preview: false,
            });

            // Track the URI of the tab opened by our split command.
            splitTabUris.push(docUri.toString());
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error splitting selected tabs: ${error}`
        );
      }
    }
  );

  // COMMAND 2: Create Split Tabs Group
  const createSplitTabGroupCmd = vscode.commands.registerCommand(
    "extension.createSplitTabGroup",
    async () => {
      try {
        const allTabs = getAllLabeledTabs();
        if (allTabs.length === 0) {
          vscode.window.showInformationMessage("No labeled tabs found.");
          return;
        }

        // Create QuickPickItems with pre-selected state.
        const items: vscode.QuickPickItem[] = allTabs.map((tab) => ({
          label: tab.label,
          picked: true,
        }));

        // Show Quick Pick with all items pre-selected.
        const pickedItems = await vscode.window.showQuickPick(items, {
          canPickMany: true,
          placeHolder: "Select tabs to add to a group",
        });

        if (!pickedItems || pickedItems.length === 0) {
          vscode.window.showInformationMessage("No tabs selected.");
          return;
        }

        // Filter to the matching Tab objects.
        const chosenTabs = allTabs.filter((tab) =>
          pickedItems.some((item) => item.label === tab.label)
        );
        if (chosenTabs.length === 0) {
          vscode.window.showInformationMessage("No matching tabs found.");
          return;
        }

        // Prompt for a group name.
        const groupName = await vscode.window.showInputBox({
          prompt: "Enter a name for this tab group",
          placeHolder: "e.g. My Favorite Tabs",
        });

        if (!groupName) {
          vscode.window.showInformationMessage("Group creation canceled.");
          return;
        }

        // Build group data: Only include text-based tab URIs.
        const uris = chosenTabs
          .filter((tab) => isTextTabInput(tab.input))
          .map((tab) => (tab.input as vscode.TabInputText).uri.toString());

        // Load existing groups.
        const existingGroups: SplitTabGroup[] = context.globalState.get(
          "splitTabGroups",
          []
        );

        // Check for a duplicate group name.
        const duplicate = existingGroups.find(
          (group) => group.name === groupName
        );
        if (duplicate) {
          const choice = await vscode.window.showWarningMessage(
            `A group named "${groupName}" already exists. Overwrite it?`,
            "Yes",
            "No"
          );
          if (choice !== "Yes") {
            return;
          }
          duplicate.uris = uris;
        } else {
          existingGroups.push({ name: groupName, uris });
        }

        // Save updated groups.
        await context.globalState.update("splitTabGroups", existingGroups);
        vscode.window.showInformationMessage(
          `Tab group "${groupName}" created successfully.`
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error creating split tab group: ${error}`
        );
      }
    }
  );

  // COMMAND 3: Open Split Tabs Group
  const openSplitTabGroupCmd = vscode.commands.registerCommand(
    "extension.openSplitTabGroup",
    async () => {
      try {
        const existingGroups: SplitTabGroup[] = context.globalState.get(
          "splitTabGroups",
          []
        );

        if (!existingGroups || existingGroups.length === 0) {
          vscode.window.showInformationMessage("No saved tab groups found.");
          return;
        }

        // Prompt user to pick a group.
        const groupName = await vscode.window.showQuickPick(
          existingGroups.map((g) => g.name),
          {
            placeHolder: "Select a tab group to open",
          }
        );

        if (!groupName) {
          vscode.window.showInformationMessage("No group selected.");
          return;
        }

        const chosenGroup = existingGroups.find((g) => g.name === groupName);
        if (!chosenGroup) {
          vscode.window.showErrorMessage(`Tab group "${groupName}" not found.`);
          return;
        }

        let currentColumn =
          vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

        for (const uriString of chosenGroup.uris) {
          const docUri = vscode.Uri.parse(uriString);
          const doc = await vscode.workspace.openTextDocument(docUri);

          if (doc.isDirty) {
            const choice = await vscode.window.showWarningMessage(
              `The file "${docUri.path}" has unsaved changes. Save before opening?`,
              "Save",
              "Skip"
            );
            if (choice === "Save") {
              await doc.save();
            } else if (choice !== "Skip") {
              continue;
            }
          }

          currentColumn++;
          if (currentColumn > vscode.ViewColumn.Nine) {
            currentColumn = vscode.ViewColumn.Nine;
          }

          await vscode.window.showTextDocument(doc, {
            viewColumn: currentColumn,
            preserveFocus: true,
            preview: false,
          });
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error opening split tab group: ${error}`
        );
      }
    }
  );

  // COMMAND 4: List all Split Tab Groups
  const listSplitTabGroupsCmd = vscode.commands.registerCommand(
    "extension.listSplitTabGroups",
    async () => {
      try {
        const existingGroups: SplitTabGroup[] = context.globalState.get(
          "splitTabGroups",
          []
        );

        if (!existingGroups || existingGroups.length === 0) {
          vscode.window.showInformationMessage("No saved tab groups found.");
          return;
        }

        const pickedGroupName = await vscode.window.showQuickPick(
          existingGroups.map((g) => g.name),
          {
            placeHolder: "Select a group to see its saved files",
          }
        );

        if (!pickedGroupName) {
          vscode.window.showInformationMessage("No group selected.");
          return;
        }

        const foundGroup = existingGroups.find(
          (g) => g.name === pickedGroupName
        );
        if (!foundGroup) {
          vscode.window.showErrorMessage(
            `Group "${pickedGroupName}" does not exist.`
          );
          return;
        }

        const fileList = foundGroup.uris.join("\n• ");
        vscode.window.showInformationMessage(
          `Files in "${foundGroup.name}":\n• ${fileList}`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Error listing tab groups: ${error}`);
      }
    }
  );

  // COMMAND 5: Delete a Split Tab Group
  const deleteSplitTabGroupCmd = vscode.commands.registerCommand(
    "extension.deleteSplitTabGroup",
    async () => {
      try {
        const existingGroups: SplitTabGroup[] = context.globalState.get(
          "splitTabGroups",
          []
        );

        if (!existingGroups || existingGroups.length === 0) {
          vscode.window.showInformationMessage("No saved tab groups found.");
          return;
        }

        const groupName = await vscode.window.showQuickPick(
          existingGroups.map((g) => g.name),
          {
            placeHolder: "Select a tab group to delete",
          }
        );

        if (!groupName) {
          vscode.window.showInformationMessage(
            "No group selected for deletion."
          );
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `Are you sure you want to delete "${groupName}"? This cannot be undone.`,
          "Yes",
          "No"
        );
        if (confirm !== "Yes") {
          vscode.window.showInformationMessage("Delete canceled.");
          return;
        }

        const updatedGroups = existingGroups.filter(
          (g) => g.name !== groupName
        );
        await context.globalState.update("splitTabGroups", updatedGroups);

        vscode.window.showInformationMessage(
          `Tab group "${groupName}" deleted successfully.`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Error deleting tab group: ${error}`);
      }
    }
  );

  // COMMAND 6: Close Split Tabs and consolidate remaining tabs into a single view.
  const closeSplitTabsCmd = vscode.commands.registerCommand(
    "extension.closeSplitTabs",
    async () => {
      try {
        // Define the main column (usually column 1)
        const mainColumn = vscode.ViewColumn.One;

        // Iterate through all tab groups except the main group.
        for (const group of vscode.window.tabGroups.all) {
          if (group.viewColumn !== mainColumn) {
            for (const tab of group.tabs) {
              if (isTextTabInput(tab.input)) {
                const uriStr = tab.input.uri.toString();
                // Close only tabs that were opened as splits.
                if (splitTabUris.includes(uriStr)) {
                  const doc = await vscode.workspace.openTextDocument(
                    tab.input.uri
                  );
                  await vscode.window.showTextDocument(doc, {
                    viewColumn: group.viewColumn,
                  });
                  await vscode.commands.executeCommand(
                    "workbench.action.closeActiveEditor"
                  );
                }
              }
            }
          }
        }

        // Clear the tracked split tabs URIs after closing them.
        splitTabUris = [];

        // Retrieve the active tab's URI to avoid moving it.
        const activeUri =
          vscode.window.activeTextEditor?.document.uri.toString();

        // Collect remaining tabs from groups that are not in the primary (first) column.
        const tabsToMove: vscode.Tab[] = [];
        vscode.window.tabGroups.all.forEach((group) => {
          if (group.viewColumn !== mainColumn) {
            group.tabs.forEach((tab) => {
              if (isTextTabInput(tab.input)) {
                const uriStr = tab.input.uri.toString();
                if (uriStr !== activeUri) {
                  tabsToMove.push(tab);
                }
              }
            });
          }
        });

        // Sort the tabs we are about to move so that any tab that originally
        // lived in the main column retains its relative position.
        const initialOrder: string[] = context.workspaceState.get(
          INITIAL_ORDER_KEY,
          []
        );
        tabsToMove.sort((a, b) => {
          if (!isTextTabInput(a.input) || !isTextTabInput(b.input)) {
            return 0;
          }
          const aUri = a.input.uri.toString();
          const bUri = b.input.uri.toString();
          const aIdx = initialOrder.indexOf(aUri);
          const bIdx = initialOrder.indexOf(bUri);

          // Tabs not in the initial list are appended to the end.
          if (aIdx === -1 && bIdx === -1) return 0;
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });
        // Open each remaining tab in the primary column.
        for (const tab of tabsToMove) {
          if (isTextTabInput(tab.input)) {
            const doc = await vscode.workspace.openTextDocument(tab.input.uri);
            await vscode.window.showTextDocument(doc, {
              viewColumn: mainColumn,
              preview: false,
            });
          }
        }

        // Consolidate the layout so that all remaining tabs are in a single group.
        await vscode.commands.executeCommand(
          "workbench.action.editorLayoutSingle"
        );

        // ────────────────────────────────────────────────────────────────
        // Re‑order the tabs in the primary group to match the exact order
        // that existed before the split. We walk the desired order *in
        // reverse*; each time we reveal a tab we immediately move it to the
        // front. When done, the group’s visual order equals `initialOrder`.
        // ────────────────────────────────────────────────────────────────
        const primaryGroup = vscode.window.tabGroups.all.find(
          (g) => g.viewColumn === mainColumn
        );

        if (primaryGroup && initialOrder.length > 0) {
          for (let i = initialOrder.length - 1; i >= 0; i--) {
            const targetUri = initialOrder[i];
            const tab = primaryGroup.tabs.find(
              (t) =>
                isTextTabInput(t.input) && t.input.uri.toString() === targetUri
            );
            if (tab && isTextTabInput(tab.input)) {
              // Reveal the tab so it becomes the active editor.
              await vscode.window.showTextDocument(tab.input.uri, {
                viewColumn: mainColumn,
                preview: false,
                preserveFocus: false,
              });
              // Move the now‑active editor to the first position.
              await vscode.commands.executeCommand("moveActiveEditor", {
                to: "first",
              });
            }
          }
        }

        // The layout is now back to a single group and the ordering restored;
        // we no longer need the saved list.
        await context.workspaceState.update(INITIAL_ORDER_KEY, []);
      } catch (error) {
        vscode.window.showErrorMessage(`Error closing split tabs: ${error}`);
      }
    }
  );

  // Register all commands.
  context.subscriptions.push(
    splitSelectedTabsCmd,
    createSplitTabGroupCmd,
    openSplitTabGroupCmd,
    listSplitTabGroupsCmd,
    deleteSplitTabGroupCmd,
    closeSplitTabsCmd
  );
}

export function deactivate() {}
