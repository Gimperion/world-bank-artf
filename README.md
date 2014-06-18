world-bank-artf
===============

## Datasets

Datasets powering this application are located on the World Bank Finances' open data portal at http://finances.worldbank.org/. There are two datasets: one for indicators and another for measurements. URLs for these datasets can be found within the JavaScript code for this application.

These datasets are (as of June 18, 2014) hidden from the public view of the catalog and will remain so indefinitely, but the API remains publicly accessible in order to power this application. This is done by calling these datasets "metadata tables," which is a Socrata-internal classification for datasets that are designed to power the content of sites. Only Socrata employees have the power to turn this on or off for a dataset.

While datasets are hidden, its contents may be edited, but new fields (i.e. columns) may not be. The dataset would need to be unhid in order to make such edits. To prevent the dataset from appearing publicly, it should be turned to private before unhiding. However, doing so will cause the visualization to stop functioning until the dataset is hidden and made public again.