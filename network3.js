function simulate(data, svg) {
    const width = parseInt(svg.attr("viewBox").split(' ')[2]);
    const height = parseInt(svg.attr("viewBox").split(' ')[3]);

    const main_group = svg.append("g")
        .attr("transform", "translate(0, 50)");

    const affiliationCountries = {};
    data.nodes.forEach(d => {
        if (d.type === "author" && d.affiliation) {
            const country = d.affiliation.split(',').pop().trim();
            if (affiliationCountries[country]) {
                affiliationCountries[country]++;
            } else {
                affiliationCountries[country] = 1;
            }
        }
    });

    const topCountries = Object.keys(affiliationCountries)
        .sort((a, b) => affiliationCountries[b] - affiliationCountries[a])
        .slice(0, 10);

    data.nodes.forEach(d => {
        if (d.type === "author" && d.affiliation) {
            const country = d.affiliation.split(',').pop().trim();  
            if (topCountries.includes(country)) {
                d.countryColor = country;  
            } else {
                d.countryColor = "#A9A9A9"; 
            }
        }
    });

    let node_degree = {};
    d3.map(data.links, (d) => {
        if (d.source in node_degree) node_degree[d.source]++;
        else node_degree[d.source] = 0;

        if (d.target in node_degree) node_degree[d.target]++;
        else node_degree[d.target] = 0;
    });

    const scale_radius = d3.scaleSqrt()
        .domain(d3.extent(Object.values(node_degree)))
        .range([3, 12]);  

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const link_elements = main_group.append("g")
        .selectAll(".line")
        .data(data.links)
        .enter()
        .append("line")
        .style("stroke-width", 2)
        .style("stroke", "#ccc");

    const node_elements = main_group.append("g")
        .selectAll(".node")
        .data(data.nodes)
        .enter()
        .append('g')
        .attr("class", function (d) {
            return "gr_" + (d.type === "author" ? "author" : "affiliation");
        })
        .on("mouseenter", function (event, d) {
            node_elements.classed("inactive", true);  
            d3.selectAll(".gr_" + d.countryColor).classed("inactive", false);  
        })
        .on("mouseleave", function () {
            node_elements.classed("inactive", false);  
        })
        .on("click", function (event, d) {
            const tooltip = d3.select("#tooltip");
            tooltip.style("display", "block")
                .style("left", `${event.pageX + 5}px`)
                .style("top", `${event.pageY + 5}px`)
                .html(
                    `<strong>Author:</strong> ${d.label}<br>
                     <strong>Year:</strong> ${d.year || "Unknown"}<br>
                     <strong>Publisher:</strong> ${d.publisher || "Unknown"}<br>
                     <strong>Affiliation:</strong> ${d.affiliation || "Unknown"}`
                );

            d3.select(this)  
                .on("mouseleave", function () {
                    tooltip.style("display", "none");
                });
        });

    node_elements.append("circle")
        .attr("r", (d, i) => scale_radius(node_degree[d.id]))  
        .attr("fill", d => d.countryColor ? color(d.countryColor) : "#A9A9A9");  

    const legend = svg.append("g")
        .attr("transform", `translate(20, 20)`);  

    topCountries.forEach((country, i) => {
        const legendItem = legend.append("g")
            .attr("transform", `translate(0, ${i * 20})`);

        legendItem.append("circle")
            .attr("r", 6)
            .attr("fill", color(country))
            .attr("cx", 0);

        legendItem.append("text")
            .attr("x", 12)
            .attr("y", 4)
            .style("font-size", "12px")
            .text(country);
    });

    let forceSimulation = d3.forceSimulation(data.nodes)
        .force("collide", d3.forceCollide().radius(d => scale_radius(node_degree[d.id]) * 1.5))
        .force("x", d3.forceX())
        .force("y", d3.forceY())
        .force("charge", d3.forceManyBody().strength(-200))
        .force("link", d3.forceLink(data.links)
            .id(d => d.id)
            .distance(100)
            .strength(0.1)
        )
        .on("tick", ticked);

    function ticked() {
        node_elements.attr('transform', (d) => `translate(${d.x},${d.y})`);
        link_elements
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
    }

    const zoom = d3.zoom()
        .extent([[0, 0], [width, height]])
        .scaleExtent([1, 8])
        .on("zoom", function ({ transform }) {
            main_group.attr("transform", transform);
        });

    svg.call(zoom);

    const forceParamsDiv = d3.select("#force-controls").append("div");
    forceParamsDiv.append("label")
        .text("Force Charge Strength: ");
    forceParamsDiv.append("input")
        .attr("type", "range")
        .attr("min", -500)
        .attr("max", -100)
        .attr("value", -200)
        .attr("step", 10)
        .attr("id", "chargeSlider")
        .on("input", function () {
            const chargeStrength = this.value;
            forceSimulation.force("charge", d3.forceManyBody().strength(chargeStrength));
            forceSimulation.alpha(1).restart();
        });

    forceParamsDiv.append("label")
        .text("Collision Radius: ");
    forceParamsDiv.append("input")
        .attr("type", "range")
        .attr("min", 2)
        .attr("max", 20)
        .attr("value", 12)
        .attr("step", 1)
        .attr("id", "collisionSlider")
        .on("input", function () {
            const collisionRadius = this.value;
            forceSimulation.force("collide", d3.forceCollide().radius(d => scale_radius(node_degree[d.id]) * (collisionRadius / 12)));
            forceSimulation.alpha(1).restart();
        });

    forceParamsDiv.append("label")
        .text("Link Strength: ");
    forceParamsDiv.append("input")
        .attr("type", "range")
        .attr("min", 0)
        .attr("max", 1)
        .attr("value", 0.1)
        .attr("step", 0.05)
        .attr("id", "linkStrengthSlider")
        .on("input", function () {
            const linkStrength = this.value;
            forceSimulation.force("link", d3.forceLink(data.links).id(d => d.id).distance(100).strength(linkStrength));
            forceSimulation.alpha(1).restart();
        });
}
