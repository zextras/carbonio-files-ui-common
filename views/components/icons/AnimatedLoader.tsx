/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { SVGProps } from 'react';

import styled, { keyframes } from 'styled-components';

const rotate = keyframes`
	from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const AnimatedLoaderSvg = styled.svg`
	animation: ${rotate} 3s ease-in-out infinite normal forwards;
`;

export const AnimatedLoader = React.forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
	function AnimatedLoaderFn(props, ref) {
		return (
			<AnimatedLoaderSvg
				id="e9AcbENh5Z71"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				shapeRendering="geometricPrecision"
				textRendering="geometricPrecision"
				fill="currentColor"
				{...props}
				ref={ref}
			>
				<g id="e9AcbENh5Z72">
					<path
						id="e9AcbENh5Z73"
						d="M12,2C11.734800,2,11.480400,2.105360,11.292900,2.292890C11.105400,2.480430,11,2.734780,11,3L11,5C11,5.265220,11.105400,5.519570,11.292900,5.707110C11.480400,5.894640,11.734800,6,12,6C12.265200,6,12.519600,5.894640,12.707100,5.707110C12.894600,5.519570,13,5.265220,13,5L13,3C13,2.734780,12.894600,2.480430,12.707100,2.292890C12.519600,2.105360,12.265200,2,12,2L12,2Z"
						fill="rgb(65,65,65)"
						stroke="none"
						strokeWidth="1"
					/>
					<path
						id="e9AcbENh5Z74"
						d="M21,11L19,11C18.734800,11,18.480400,11.105400,18.292900,11.292900C18.105400,11.480400,18,11.734800,18,12C18,12.265200,18.105400,12.519600,18.292900,12.707100C18.480400,12.894600,18.734800,13,19,13L21,13C21.265200,13,21.519600,12.894600,21.707100,12.707100C21.894600,12.519600,22,12.265200,22,12C22,11.734800,21.894600,11.480400,21.707100,11.292900C21.519600,11.105400,21.265200,11,21,11Z"
						fill="rgb(65,65,65)"
						stroke="none"
						strokeWidth="1"
					/>
					<path
						id="e9AcbENh5Z75"
						d="M6,12C6,11.734800,5.894640,11.480400,5.707110,11.292900C5.519570,11.105400,5.265220,11,5,11L3,11C2.734780,11,2.480430,11.105400,2.292890,11.292900C2.105360,11.480400,2,11.734800,2,12C2,12.265200,2.105360,12.519600,2.292890,12.707100C2.480430,12.894600,2.734780,13,3,13L5,13C5.265220,13,5.519570,12.894600,5.707110,12.707100C5.894640,12.519600,6,12.265200,6,12Z"
						transform="matrix(1 0 0 1 0.26234975000000 0)"
						fill="rgb(65,65,65)"
						stroke="none"
						strokeWidth="1"
					/>
					<path
						id="e9AcbENh5Z76"
						d="M6.220230,4.999950C6.025300,4.815620,5.765120,4.716280,5.496950,4.723780C5.228770,4.731290,4.974560,4.845010,4.790230,5.039950C4.605910,5.234880,4.506570,5.495050,4.514070,5.763230C4.521570,6.031410,4.635300,6.285620,4.830230,6.469950L6.270230,7.859950C6.366870,7.953260,6.481310,8.026140,6.606730,8.074250C6.732150,8.122360,6.865980,8.144700,7.000230,8.139950C7.134940,8.139430,7.268150,8.111710,7.391870,8.058440C7.515600,8.005170,7.627280,7.927450,7.720230,7.829950C7.906480,7.642580,8.011020,7.389130,8.011020,7.124950C8.011020,6.860760,7.906480,6.607310,7.720230,6.419950L6.220230,4.999950Z"
						transform="matrix(1 0 0 1 0.02050050000000 0)"
						fill="rgb(43,115,210)"
						stroke="none"
						strokeWidth="1"
					/>
					<path
						id="e9AcbENh5Z77"
						d="M16.999600,8.139990C17.257100,8.138970,17.504200,8.038670,17.689600,7.859990L19.129600,6.469990C19.305300,6.286440,19.404500,6.042910,19.407100,5.788860C19.409700,5.534810,19.315600,5.289290,19.143700,5.102160C18.971900,4.915030,18.735200,4.800340,18.481900,4.781360C18.228500,4.762380,17.977400,4.840550,17.779600,4.999990L16.339600,6.419990C16.153400,6.607350,16.048800,6.860810,16.048800,7.124990C16.048800,7.389180,16.153400,7.642630,16.339600,7.829990C16.512800,8.012710,16.748400,8.123410,16.999600,8.139990Z"
						fill="rgb(65,65,65)"
						stroke="none"
						strokeWidth="1"
					/>
					<path
						id="e9AcbENh5Z78"
						d="M12,18C11.734800,18,11.480400,18.105400,11.292900,18.292900C11.105400,18.480400,11,18.734800,11,19L11,21C11,21.265200,11.105400,21.519600,11.292900,21.707100C11.480400,21.894600,11.734800,22,12,22C12.265200,22,12.519600,21.894600,12.707100,21.707100C12.894600,21.519600,13,21.265200,13,21L13,19C13,18.734800,12.894600,18.480400,12.707100,18.292900C12.519600,18.105400,12.265200,18,12,18Z"
						fill="rgb(65,65,65)"
						stroke="none"
						strokeWidth="1"
					/>
					<path
						id="e9AcbENh5Z79"
						d="M17.729900,16.140000C17.538900,15.955600,17.282600,15.854700,17.017200,15.859400C16.751800,15.864100,16.499200,15.974000,16.314900,16.165000C16.130600,16.355900,16.029600,16.612300,16.034300,16.877600C16.039000,17.143000,16.148900,17.395600,16.339900,17.580000L17.779900,19C17.965300,19.178600,18.212400,19.278900,18.469900,19.280000C18.603900,19.280700,18.736700,19.254600,18.860300,19.203100C18.984000,19.151500,19.096100,19.075700,19.189900,18.980000C19.283600,18.887000,19.358000,18.776400,19.408800,18.654500C19.459600,18.532700,19.485700,18.402000,19.485700,18.270000C19.485700,18.138000,19.459600,18.007200,19.408800,17.885400C19.358000,17.763500,19.283600,17.652900,19.189900,17.560000L17.729900,16.140000Z"
						transform="matrix(1 0 0 1 -0.03194850000000 0)"
						fill="rgb(65,65,65)"
						stroke="none"
						strokeWidth="1"
					/>
					<path
						id="e9AcbENh5Z710"
						d="M6.269980,16.140000L4.829980,17.530000C4.736250,17.623000,4.661860,17.733600,4.611090,17.855400C4.560320,17.977300,4.534180,18.108000,4.534180,18.240000C4.534180,18.372000,4.560320,18.502700,4.611090,18.624600C4.661860,18.746400,4.736250,18.857000,4.829980,18.950000C4.923770,19.045700,5.035840,19.121600,5.159520,19.173100C5.283210,19.224600,5.415990,19.250800,5.549980,19.250000C5.796490,19.252100,6.035090,19.163100,6.219980,19L7.659980,17.610000C7.850930,17.425700,7.960850,17.173000,7.965530,16.907700C7.970220,16.642300,7.869300,16.385900,7.684980,16.195000C7.500650,16.004000,7.248020,15.894100,6.982660,15.889400C6.717290,15.884800,6.460930,15.985700,6.269980,16.170000L6.269980,16.140000Z"
						fill="rgb(65,65,65)"
						stroke="none"
						strokeWidth="1"
					/>
				</g>
			</AnimatedLoaderSvg>
		);
	}
);
