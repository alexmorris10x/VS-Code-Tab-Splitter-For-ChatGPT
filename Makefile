gh: 
	git add .
	git commit -m "update"
	git push origin

tree:
	tree -I 'node_modules|archive|Makefile|file_structure.txt|-archive' > .tree.txt