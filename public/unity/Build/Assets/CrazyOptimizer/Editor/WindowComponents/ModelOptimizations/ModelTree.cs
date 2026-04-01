using CrazyGames.TreeLib;
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEditor.IMGUI.Controls;
using UnityEngine;

#if UNITY_6000_0_OR_NEWER
using BaseTreeViewItem = UnityEditor.IMGUI.Controls.TreeViewItem<int>;
using BaseTreeViewState = UnityEditor.IMGUI.Controls.TreeViewState<int>;
#else
using BaseTreeViewItem = UnityEditor.IMGUI.Controls.TreeViewItem;
using BaseTreeViewState = UnityEditor.IMGUI.Controls.TreeViewState;
#endif

namespace CrazyGames.WindowComponents.ModelOptimizations
{
    class ModelTree : TreeViewWithTreeModel<ModelTreeItem>
    {
        public ModelTree(BaseTreeViewState treeViewState, MultiColumnHeader multiColumnHeader, TreeModel<ModelTreeItem> model)
            : base(treeViewState, multiColumnHeader, model)
        {
            showBorder = true;
            showAlternatingRowBackgrounds = true;
            multiColumnHeader.sortingChanged += OnSortingChanged;
            Reload();
        }

        void SortIfNeeded(BaseTreeViewItem root, IList<BaseTreeViewItem> rows)
        {
            if (rows.Count <= 1)
                return;

            if (multiColumnHeader.sortedColumnIndex == -1)
            {
                return; // No column to sort for (just use the order the data are in)
            }

            var sortedColumns = multiColumnHeader.state.sortedColumns;

            if (sortedColumns.Length == 0)
                return;

            var items = rootItem.children.Cast<TreeViewDataItem<ModelTreeItem>>().OrderBy(i => i.data.ModelName);
            var sortedColumnIndex = sortedColumns[0];
            var ascending = multiColumnHeader.IsSortedAscending(sortedColumnIndex);

            switch (sortedColumnIndex)
            {
                case 0:
                    items = items.Order(i => i.data.ModelName, ascending);
                    break;
                case 1:
                    items = items.Order(i => i.data.IsReadWriteEnabled, ascending);
                    break;
                case 2:
                    items = items.Order(i => i.data.ArePolygonsOptimized, ascending);
                    break;
                case 3:
                    items = items.Order(i => i.data.AreVerticesOptimized, ascending);
                    break;
                case 4:
                    items = items.Order(i => i.data.MeshCompression, ascending);
                    break;
                case 5:
                    items = items.Order(i => i.data.AnimationCompression, ascending);
                    break;
            }

            rootItem.children = items.Cast<BaseTreeViewItem>().ToList();
            TreeToList(root, rows);
            Repaint();
        }

        public static void TreeToList(BaseTreeViewItem root, IList<BaseTreeViewItem> result)
        {
            if (root == null)
                throw new NullReferenceException("root");
            if (result == null)
                throw new NullReferenceException("result");

            result.Clear();

            if (root.children == null)
                return;

            Stack<BaseTreeViewItem> stack = new Stack<BaseTreeViewItem>();

            for (int i = root.children.Count - 1; i >= 0; i--)
                stack.Push(root.children[i]);

            while (stack.Count > 0)
            {
                BaseTreeViewItem current = stack.Pop();
                result.Add(current);

                if (current.hasChildren && current.children[0] != null)
                {
                    for (int i = current.children.Count - 1; i >= 0; i--)
                    {
                        stack.Push(current.children[i]);
                    }
                }
            }
        }

        void OnSortingChanged(MultiColumnHeader multiColumnHeader)
        {
            SortIfNeeded(rootItem, GetRows());
        }

        protected override IList<BaseTreeViewItem> BuildRows(BaseTreeViewItem root)
        {
            var rows = base.BuildRows(root);
            SortIfNeeded(root, rows);
            return rows;
        }

        protected override void RowGUI(RowGUIArgs args)
        {
            var item = (TreeViewDataItem<ModelTreeItem>)args.item;

            for (int i = 0; i < args.GetNumVisibleColumns(); ++i)
            {
                CellGUI(args.GetCellRect(i), item, args.GetColumn(i), ref args);
            }
        }

        private void CellGUI(Rect cellRect, TreeViewDataItem<ModelTreeItem> item, int column, ref RowGUIArgs args)
        {
            CenterRectUsingSingleLineHeight(ref cellRect);
            switch (column)
            {
                case 0:
                    GUI.Label(cellRect, item.data.ModelName);
                    break;
                case 1:
                    GUI.Label(cellRect, item.data.IsReadWriteEnabled ? "yes" : "no");
                    break;
                case 2:
                    GUI.Label(cellRect, item.data.ArePolygonsOptimized ? "yes" : "no");
                    break;
                case 3:
                    GUI.Label(cellRect, item.data.AreVerticesOptimized ? "yes" : "no");
                    break;
                case 4:
                    GUI.Label(cellRect, item.data.MeshCompressionName);
                    break;
                case 5:
                    GUI.Label(cellRect, item.data.AnimationCompressionName);
                    break;
            }
        }

        protected override void SelectionChanged(IList<int> selectedIds)
        {
            base.SelectionChanged(selectedIds);
            var item = treeModel.Find(selectedIds.First());
            Selection.activeObject = AssetDatabase.LoadMainAssetAtPath(item.ModelPath);
        }
    }
}
