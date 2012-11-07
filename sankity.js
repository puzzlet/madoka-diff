// based on https://github.com/d3/d3-plugins/tree/master/sankity

d3.sankity = function() {
  var sankity = {},
      nodeWidth = 24,
      nodePadding = 8,
      titleHeight = 20,
      size = [1, 1],
      nodes = [],
      links = [];

  sankity.nodeWidth = function(_) {
    if (!arguments.length) return nodeWidth;
    nodeWidth = +_;
    return sankity;
  };

  sankity.nodePadding = function(_) {
    if (!arguments.length) return nodePadding;
    nodePadding = +_;
    return sankity;
  };

  sankity.nodes = function(_) {
    if (!arguments.length) return nodes;
    nodes = _;
    return sankity;
  };

  sankity.links = function(_) {
    if (!arguments.length) return links;
    links = _;
    return sankity;
  };

  sankity.size = function(_) {
    if (!arguments.length) return size;
    size = _;
    return sankity;
  };

  sankity.layout = function(iterations) {
    computeNodeLinks();
    computeNodeBreadths();
    computeNodeDepths(iterations);
    computeLinkDepths();
    return sankity;
  };

  sankity.relayout = function(viewport) {
    computeNodeDepths(32, viewport);
    computeLinkDepths();
    return sankity;
  };

  // Populate the sourceLinks and targetLinks for each node.
  // Also, if the source and target are not objects, assume they are indices.
  function computeNodeLinks() {
    nodes.forEach(function(node) {
      node.sourceLinks = [];
      node.targetLinks = [];
    });
    links.forEach(function(link) {
      var source = link.source,
          target = link.target;
      if (typeof source === "number") source = link.source = nodes[link.source];
      if (typeof target === "number") target = link.target = nodes[link.target];
      source.sourceLinks.push(link);
      target.targetLinks.push(link);
    });
  }

  // Iteratively assign the breadth (x-position) for each node.
  // Nodes are assigned the maximum breadth of incoming neighbors plus one;
  // nodes with no incoming links are assigned breadth zero, while
  // nodes with no outgoing links are assigned the maximum breadth.
  function computeNodeBreadths() {
    var remainingNodes = nodes,
        nextNodes,
        x = 0;

    while (remainingNodes.length) {
      nextNodes = [];
      remainingNodes.forEach(function(node) {
        node.x = x;
        node.dx = nodeWidth;
        node.sourceLinks.forEach(function(link) {
          nextNodes.push(link.target);
        });
      });
      remainingNodes = nextNodes;
      ++x;
    }

    //
    moveSinksRight(x);
    scaleNodeBreadths((size[0] - nodeWidth) / (x - 1));
  }

  function moveSourcesRight() {
    nodes.forEach(function(node) {
      if (!node.targetLinks.length) {
        node.x = d3.min(node.sourceLinks, function(d) { return d.target.x; }) - 1;
      }
    });
  }

  function moveSinksRight(x) {
    nodes.forEach(function(node) {
      if (!node.sourceLinks.length) {
        node.x = x - 1;
      }
    });
  }

  function scaleNodeBreadths(kx) {
    nodes.forEach(function(node) {
      node.x *= kx;
    });
  }

  function computeNodeDepths(iterations, viewport) {
    var nodesByBreadth = d3.nest()
        .key(function(d) { return d.x; })
        .sortKeys(d3.ascending)
        .entries(nodes)
        .map(function(d) { return d.values; });

    initializeNodeDepth();
    resolveCollisions();
    for (var alpha = 1; iterations > 0; --iterations) {
      relaxRightToLeft(alpha *= .99);
      resolveCollisions();
      relaxLeftToRight(alpha);
      resolveCollisions();
    }

    function initializeNodeDepth() {
      var ky = d3.min(nodesByBreadth, function(nodes) {
        return (size[1] - (nodes.length - 1) * (nodePadding) - nodes.length * titleHeight) / d3.sum(nodes, value);
      });

      nodesByBreadth.forEach(function(nodes) {
        nodes.forEach(function(node, i) {
          node.y = i;
          node.dy = node.value * ky;
        });
      });

      links.forEach(function(link) {
        link.dy = link.value * ky;
      });
    }

    function relaxLeftToRight(alpha) {
      nodesByBreadth.forEach(function(nodes, breadth) {
        nodes.forEach(function(node) {
          if (node.targetLinks.length) {
            var y = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedSource(link) {
        if (!visible(link.source))
          return 0.1;
        return center(link.source) * link.value;
      }

      function value(link) {
        if (!visible(link.source))
          return 0.1;
        return link.value;
      }
    }

    function relaxRightToLeft(alpha) {
      nodesByBreadth.slice().reverse().forEach(function(nodes) {
        nodes.forEach(function(node) {
          if (node.sourceLinks.length) {
            var y = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedTarget(link) {
        if (!visible(link.target))
          return 0.1;
        return center(link.target) * link.value;
      }

      function value(link) {
        if (!visible(link.target))
          return 0.1;
        return link.value;
      }
    }

    function resolveCollisions() {
      nodesByBreadth.forEach(function(nodes) {
        var node,
            dy,
            y0 = titleHeight,
            n = nodes.length,
            i;

        // Push any overlapping nodes down.
//        nodes.sort(ascendingDepth);
        for (i = 0; i < n; ++i) {
          node = nodes[i];
          dy = y0 - node.y;
          if (dy > 0) node.y += dy;
          y0 = node.y + node.dy + nodePadding + titleHeight;
        }

        // If the bottommost node goes outside the bounds, push it back up.
        dy = y0 - nodePadding - titleHeight - size[1];
        if (dy > 0) {
          y0 = node.y -= dy;

          // Push any overlapping nodes back up.
          for (i = n - 2; i >= 0; --i) {
            node = nodes[i];
            dy = node.y + node.dy + nodePadding + titleHeight - y0;
            if (dy > 0) node.y -= dy;
            y0 = node.y;
          }
        }
      });
    }

    function ascendingDepth(a, b) {
      return a.y - b.y;
    }

    function visible(node) {
      if (!viewport)
        return true;
      return ! (viewport.bottom < node.y ||
          viewport.top > node.dy + node.y);
    }
  }

  function computeLinkDepths() {
    nodes.forEach(function(node) {
      node.sourceLinks.sort(ascendingTargetDepth);
      node.targetLinks.sort(ascendingSourceDepth);
    });
    nodes.forEach(function(node) {
      var sy = 0, ty = 0;
      node.sourceLinks.forEach(function(link) {
        link.sy = sy;
        sy += link.dy;
      });
      node.targetLinks.forEach(function(link) {
        link.ty = ty;
        ty += link.dy;
      });
    });

    function ascendingSourceDepth(a, b) {
      return a.source.y - b.source.y;
    }

    function ascendingTargetDepth(a, b) {
      return a.target.y - b.target.y;
    }
  }

  function center(node) {
    return node.y + node.dy / 2;
  }

  function value(link) {
    return link.value;
  }

  return sankity;
};


d3.sankity_link = function(sankity) {
  var curvature = 0.5,
      offset = 15;

  function sankity_link(a) {
    if (a instanceof Array) {
      a.each(__sankity_link);
    } else {
      d3.select(this).each(__sankity_link);
    }
  };

  function __sankity_link(d) {
    var e = d3.select(this);
    e.append("path")
      .attr("class", "flow")
      .attr("d", sankity_link.path(d))
      .append("title")
      .text(function(d) {
        return d.source.name + " -> " + d.target.name + "\n" + d.value;
      });
    e.append("path")
      .attr("class", "brace")
      .attr("d", _brace(d, true));
    e.append("path")
      .attr("class", "brace")
      .attr("d", _brace(d, false));
  };

  function _brace(d, isSource) {
      var o = isSource ? d.source : d.target,
          oo = isSource ? d.source_offset : d.target_offset;
          dx = isSource ? 1 : -1;
      var x0 = o.x + (isSource ? o.dx : 0),
          x1 = x0 + dx * offset,
          y0 = o.y + (oo / d.value * d.dy);
          y1 = y0 + d.dy / 2,
          y2 = y0 + d.dy;
      return "M" + x0 + "," + y0
           + "C" + x1 + "," + y0
           + " " + x0 + "," + y1
           + " " + x1 + "," + y1
           + " " + x0 + "," + y1
           + " " + x1 + "," + y2
           + " " + x0 + "," + y2;
  };

  sankity_link.path = function (d) {
    var x0 = d.source.x + d.source.dx + offset,
        x1 = d.target.x - offset,
        xi = d3.interpolateNumber(x0, x1),
        x2 = xi(curvature),
        x3 = xi(1 - curvature),
        y0 = d.source.y + (d.source_offset / d.value * d.dy) + d.dy / 2,
        y1 = d.target.y + (d.target_offset / d.value * d.dy) + d.dy / 2;
    return "M" + x0 + "," + y0
         + "C" + x2 + "," + y0
         + " " + x3 + "," + y1
         + " " + x1 + "," + y1;
  };

  return sankity_link;
};


d3.sankity_node = function(sankity) {
  function sankity_node(a) {
    if (a instanceof Array) {
      a.each(__sankity_node);
    } else {
      d3.select(this).each(__sankity_node);
    }
  };

  function __sankity_node(d) {
    var e = d3.select(this);
    e.append("rect")
      .attr("height", function(d) {
        return d.dy;
      })
      .attr("width", sankity.nodeWidth())
      .style("fill", function(d) {
        return d.color = '#303030';
      })
      .style("stroke", function(d) {
        return d3.rgb(d.color).darker(-2);
      })
      .append("title")
      .text(function(d) {
        return d.name + "\n" + d.value;
      });

    var text = e.append("text")
      .attr("x", sankity.nodeWidth() / 2)
      .attr("y", -10)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("transform", null)
      .text(d.name);
  }

  return sankity_node;
};

// vim: ts=2 sts=2 sw=2
